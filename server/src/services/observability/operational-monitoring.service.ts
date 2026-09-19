/**
 * NovaPay Operational Monitoring & Alerting Engine
 * 
 * Tracks operational telemetry, monitors failure domains, and creates actionable alerts:
 * 1. API errors (5xx, unhandled controller exceptions)
 * 2. Provider failures (Fairway, MoneyGram, Worldpay connection drops, timeouts, 503s)
 * 3. Webhook failures (signature rejections, stale timestamps, payload parse failures)
 * 4. Blockchain failures (Midnight Preview RPC node disconnects, extrinsic errors, chain mismatches)
 * 5. Stuck remittances (remittances remaining in non-terminal states past operational TTL)
 * 6. Stuck payouts (off-ramp disbursements remaining in non-terminal states past operational TTL)
 * 7. Reconciliation exceptions (tri-party ledger discrepancies between DB, Provider, and Midnight)
 * 8. Database errors (PostgreSQL connection pool exhaustion, timeout, query failure)
 * 9. Compliance failures (sanctions match, prohibited jurisdiction attempts, invalid ZK proofs)
 */

import { StructuredLogger, LogDomain, LogLevel, TraceContext, sanitizeLogData } from '../../utils/structured-logger';
import prisma from '../../config/db';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface OperationalAlert {
  alertId: string;
  domain: LogDomain;
  severity: AlertSeverity;
  title: string;
  details: string;
  trace: TraceContext;
  status: AlertStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  metadata?: Record<string, any>;
}

export interface DomainMetrics {
  totalEvents: number;
  errorCount: number;
  criticalCount: number;
  lastEventTimestamp: string | null;
}

export interface OperationalMetrics {
  systemUptimeSeconds: number;
  activeAlertsCount: number;
  criticalAlertsCount: number;
  domains: Record<LogDomain, DomainMetrics>;
}

export class OperationalMonitoringService {
  // In-memory alert registry for rapid lookup, testing, and operational dashboards
  private static alerts = new Map<string, OperationalAlert>();

  // Domain counters
  private static metrics: Record<LogDomain, DomainMetrics> = {
    API: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    PROVIDER: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    WEBHOOK: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    BLOCKCHAIN: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    REMITTANCE: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    PAYOUT: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    RECONCILIATION: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    DATABASE: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    COMPLIANCE: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
    SECURITY: { totalEvents: 0, errorCount: 0, criticalCount: 0, lastEventTimestamp: null },
  };

  private static processStartTime = Date.now();

  public static clearState(): void {
    this.alerts.clear();
    StructuredLogger.clearBuffer();
    for (const domain of Object.keys(this.metrics) as LogDomain[]) {
      this.metrics[domain] = {
        totalEvents: 0,
        errorCount: 0,
        criticalCount: 0,
        lastEventTimestamp: null,
      };
    }
  }

  /**
   * Records an operational telemetry event, updates domain metrics, and emits structured log.
   */
  public static recordEvent(params: {
    domain: LogDomain;
    event: string;
    level: LogLevel;
    message: string;
    trace?: TraceContext;
    metadata?: Record<string, any>;
    error?: any;
    createAlertIfCritical?: boolean;
  }): { logEntry: any; alert?: OperationalAlert } {
    const { domain, event, level, message, trace = {}, metadata, error, createAlertIfCritical = true } = params;

    // 1. Structured log entry
    const logEntry = StructuredLogger.formatEntry(level, domain, event, message, trace, metadata, error);

    // 2. Update domain metrics
    const metric = this.metrics[domain];
    if (metric) {
      metric.totalEvents++;
      metric.lastEventTimestamp = logEntry.timestamp;
      if (level === 'ERROR') metric.errorCount++;
      if (level === 'CRITICAL') metric.criticalCount++;
    }

    // 3. Auto-generate alert if level is CRITICAL or explicitly requested
    let alert: OperationalAlert | undefined = undefined;
    if (level === 'CRITICAL' && createAlertIfCritical) {
      alert = this.createAlert({
        domain,
        severity: 'CRITICAL',
        title: `CRITICAL: ${domain} - ${event}`,
        details: message,
        trace,
        metadata: {
          ...metadata,
          errorSummary: error ? (error.message || String(error)) : undefined,
        },
      });
    }

    return { logEntry, alert };
  }

  /**
   * Creates an operational alert for critical or elevated issues.
   */
  public static createAlert(params: {
    domain: LogDomain;
    severity: AlertSeverity;
    title: string;
    details: string;
    trace?: TraceContext;
    metadata?: Record<string, any>;
  }): OperationalAlert {
    const { domain, severity, title, details, trace = {}, metadata } = params;
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const sanitizedMeta = metadata ? sanitizeLogData(metadata) : undefined;

    const alertRecord: OperationalAlert = {
      alertId,
      domain,
      severity,
      title,
      details,
      trace: {
        remittanceId: trace.remittanceId,
        quoteId: trace.quoteId,
        providerOrderId: trace.providerOrderId,
        blockchainTransactionId: trace.blockchainTransactionId,
        correlationId: trace.correlationId || 'system',
        userId: trace.userId,
        walletAddress: trace.walletAddress,
      },
      status: 'ACTIVE',
      createdAt: now,
      ...(sanitizedMeta ? { metadata: sanitizedMeta } : {}),
    };

    this.alerts.set(alertId, alertRecord);

    // Audit log persistence in PostgreSQL
    try {
      prisma.auditLog
        .create({
          data: {
            user_id: trace.userId || 'SYSTEM',
            action: `ALERT_TRIGGERED_${severity}`,
            resource_type: 'OPERATIONAL_ALERT',
            resource_id: alertId,
            metadata: JSON.stringify({
              domain,
              severity,
              title,
              trace,
            }),
          },
        })
        .catch(() => {});
    } catch {}

    return alertRecord;
  }

  /**
   * Resolves an active alert.
   */
  public static resolveAlert(
    alertId: string,
    resolvedBy = 'OPERATIONS_ENGINEER',
    resolutionReason = 'Resolved after manual verification or automated failover'
  ): OperationalAlert {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;
    alert.resolutionReason = resolutionReason;

    this.alerts.set(alertId, alert);

    StructuredLogger.info(
      alert.domain,
      'ALERT_RESOLVED',
      `Alert '${alert.alertId}' marked RESOLVED by ${resolvedBy}: ${resolutionReason}`,
      alert.trace
    );

    return alert;
  }

  /**
   * Retrieves all active alerts, optionally filtered by severity.
   */
  public static getActiveAlerts(severity?: AlertSeverity): OperationalAlert[] {
    const all = Array.from(this.alerts.values()).filter((a) => a.status === 'ACTIVE');
    if (severity) {
      return all.filter((a) => a.severity === severity);
    }
    return all;
  }

  /**
   * Retrieves full alert history.
   */
  public static getAllAlerts(): OperationalAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Returns complete operational telemetry metrics across all 9 domains.
   */
  public static getMetrics(): OperationalMetrics {
    const active = this.getActiveAlerts();
    const critical = active.filter((a) => a.severity === 'CRITICAL');

    return {
      systemUptimeSeconds: Math.floor((Date.now() - this.processStartTime) / 1000),
      activeAlertsCount: active.length,
      criticalAlertsCount: critical.length,
      domains: { ...this.metrics },
    };
  }

  // =========================================================================
  // Specific Domain Monitor Helpers (Conforming directly to Phase 17 specs)
  // =========================================================================

  /**
   * 1. Monitor: API Errors
   */
  public static recordApiError(
    endpoint: string,
    statusCode: number,
    err: any,
    trace?: TraceContext
  ): { logEntry: any; alert?: OperationalAlert } {
    const is5xx = statusCode >= 500;
    return this.recordEvent({
      domain: 'API',
      event: is5xx ? 'HTTP_SERVER_ERROR' : 'HTTP_CLIENT_ERROR',
      level: is5xx ? 'CRITICAL' : 'WARN',
      message: `API request to '${endpoint}' failed with HTTP ${statusCode}: ${err?.message || err}`,
      trace,
      metadata: { endpoint, statusCode },
      error: err,
    });
  }

  /**
   * 2. Monitor: Provider Failures
   */
  public static recordProviderFailure(
    provider: string,
    operation: string,
    err: any,
    trace?: TraceContext
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'PROVIDER',
      event: 'PROVIDER_OUTAGE',
      level: 'CRITICAL',
      message: `External partner provider '${provider}' failure during operation '${operation}': ${err?.message || err}`,
      trace,
      metadata: { provider, operation },
      error: err,
    });
  }

  /**
   * 3. Monitor: Webhook Failures
   */
  public static recordWebhookFailure(
    provider: string,
    reason: string,
    trace?: TraceContext,
    meta?: Record<string, any>
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'WEBHOOK',
      event: 'WEBHOOK_FAILURE',
      level: 'CRITICAL',
      message: `Inbound webhook rejection for provider '${provider}': ${reason}`,
      trace,
      metadata: { provider, reason, ...meta },
    });
  }

  /**
   * 4. Monitor: Blockchain Failures
   */
  public static recordBlockchainFailure(
    operation: string,
    err: any,
    trace?: TraceContext
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'BLOCKCHAIN',
      event: 'BLOCKCHAIN_FAILURE',
      level: 'CRITICAL',
      message: `Midnight Preview settlement failure during '${operation}': ${err?.message || err}`,
      trace,
      metadata: { operation, network: 'preview' },
      error: err,
    });
  }

  /**
   * 5. Monitor: Stuck Remittances
   */
  public static recordStuckRemittance(
    remittanceId: string,
    currentState: string,
    ageMinutes: number,
    trace?: TraceContext
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'REMITTANCE',
      event: 'STUCK_REMITTANCE',
      level: 'CRITICAL',
      message: `Remittance '${remittanceId}' stuck in '${currentState}' for ${ageMinutes}m (exceeds SLA threshold).`,
      trace: { ...trace, remittanceId },
      metadata: { remittanceId, currentState, ageMinutes },
    });
  }

  /**
   * 6. Monitor: Stuck Payouts
   */
  public static recordStuckPayout(
    payoutOrderId: string,
    currentState: string,
    ageMinutes: number,
    trace?: TraceContext
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'PAYOUT',
      event: 'STUCK_PAYOUT',
      level: 'CRITICAL',
      message: `Off-ramp payout '${payoutOrderId}' stuck in '${currentState}' for ${ageMinutes}m (exceeds SLA threshold).`,
      trace: { ...trace, providerOrderId: payoutOrderId },
      metadata: { payoutOrderId, currentState, ageMinutes },
    });
  }

  /**
   * 7. Monitor: Reconciliation Exceptions
   */
  public static recordReconciliationException(
    reconciliationId: string,
    discrepancyReason: string,
    trace?: TraceContext,
    meta?: Record<string, any>
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'RECONCILIATION',
      event: 'RECONCILIATION_EXCEPTION',
      level: 'CRITICAL',
      message: `Tri-party ledger reconciliation mismatch on record '${reconciliationId}': ${discrepancyReason}`,
      trace,
      metadata: { reconciliationId, discrepancyReason, ...meta },
    });
  }

  /**
   * 8. Monitor: Database Errors
   */
  public static recordDatabaseError(
    operation: string,
    err: any,
    trace?: TraceContext
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'DATABASE',
      event: 'DATABASE_ERROR',
      level: 'CRITICAL',
      message: `PostgreSQL database operation '${operation}' failed: ${err?.message || err}`,
      trace,
      metadata: { operation },
      error: err,
    });
  }

  /**
   * 9. Monitor: Compliance Failures
   */
  public static recordComplianceFailure(
    userId: string,
    reason: string,
    trace?: TraceContext,
    meta?: Record<string, any>
  ): { logEntry: any; alert?: OperationalAlert } {
    return this.recordEvent({
      domain: 'COMPLIANCE',
      event: 'COMPLIANCE_FAILURE',
      level: 'CRITICAL',
      message: `Compliance or sanctions screening failure for user '${userId}': ${reason}`,
      trace: { ...trace, userId },
      metadata: { userId, reason, ...meta },
    });
  }
}
