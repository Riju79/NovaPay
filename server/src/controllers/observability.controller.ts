/**
 * NovaPay Observability & Health Controller
 * 
 * Exposes:
 * - GET /health (Comprehensive deep health inspection)
 * - GET /health/live (Liveness probe)
 * - GET /health/ready (Readiness probe)
 * - GET /api/observability/metrics (Domain operational metrics)
 * - GET /api/observability/alerts (Active & resolved alerts)
 * - POST /api/observability/alerts/:id/resolve (Manual alert resolution)
 */

import { Request, Response } from 'express';
import prisma from '../config/db';
import { serverConfig } from '../config/environment';
import { MidnightBlockchainService } from '../services/midnight-blockchain.service';
import { OperationalMonitoringService } from '../services/observability/operational-monitoring.service';
import { StuckTransactionMonitor } from '../services/observability/stuck-transaction-monitor';

export class ObservabilityController {
  /**
   * Deep health check
   */
  public static async getHealth(req: Request, res: Response): Promise<void> {
    const checks: Record<string, { status: 'UP' | 'DOWN'; latencyMs: number; details?: any }> = {};
    let isOverallHealthy = true;

    // 1. Database Check
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'UP',
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: any) {
      checks.database = {
        status: 'DOWN',
        latencyMs: Date.now() - dbStart,
        details: err?.message || 'Database ping failed',
      };
      // In test/mock mode without postgresql running, don't hard-fail if DATABASE_URL is mock
      if (process.env.NODE_ENV === 'production') {
        isOverallHealthy = false;
      }
    }

    // 2. Midnight Preview RPC Check
    const rpcStart = Date.now();
    try {
      const net = await MidnightBlockchainService.getNetwork();
      checks.midnightRpc = {
        status: 'UP',
        latencyMs: Date.now() - rpcStart,
        details: {
          chain: net.chain,
          network: net.network,
          blockHeight: net.blockHeight,
        },
      };
    } catch (err: any) {
      checks.midnightRpc = {
        status: 'DOWN',
        latencyMs: Date.now() - rpcStart,
        details: err?.message || 'RPC node ping failed',
      };
      isOverallHealthy = false;
    }

    // 3. Operational Alerts
    const activeCritical = OperationalMonitoringService.getActiveAlerts('CRITICAL');
    if (activeCritical.length > 0) {
      isOverallHealthy = false;
    }

    const memoryUsage = process.memoryUsage();

    const responsePayload = {
      status: isOverallHealthy ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      environment: serverConfig.env,
      midnightNetwork: serverConfig.midnight.network,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      checks,
      activeCriticalAlertsCount: activeCritical.length,
      correlationId: req.correlationId,
    };

    res.status(isOverallHealthy ? 200 : 503).json(responsePayload);
  }

  /**
   * Liveness probe (Returns 200 if Node process is alive)
   */
  public static getLiveness(req: Request, res: Response): void {
    res.status(200).json({
      status: 'ALIVE',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  /**
   * Readiness probe (Returns 200 if dependencies are ready)
   */
  public static async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const net = await MidnightBlockchainService.getNetwork();
      if (!net || (!net.isPreview && !net.isPreprod)) {
        res.status(503).json({ status: 'NOT_READY', reason: 'Midnight Preview rail not connected' });
        return;
      }
      res.status(200).json({ status: 'READY', network: net.network, chain: net.chain });
    } catch (err: any) {
      res.status(503).json({ status: 'NOT_READY', error: err?.message });
    }
  }

  /**
   * Operational telemetry metrics across all 9 domains
   */
  public static getMetrics(req: Request, res: Response): void {
    const metrics = OperationalMonitoringService.getMetrics();
    res.status(200).json({
      success: true,
      metrics,
      correlationId: req.correlationId,
    });
  }

  /**
   * Active and recent alerts feed
   */
  public static getAlerts(req: Request, res: Response): void {
    const severity = req.query.severity as any;
    const alerts = severity
      ? OperationalMonitoringService.getActiveAlerts(severity)
      : OperationalMonitoringService.getAllAlerts();

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
      correlationId: req.correlationId,
    });
  }

  /**
   * Resolve an alert manually
   */
  public static resolveAlert(req: Request, res: Response): void {
    const { id } = req.params;
    const { resolvedBy, reason } = req.body || {};

    try {
      const resolved = OperationalMonitoringService.resolveAlert(
        id,
        resolvedBy || (req as any).user?.userId || 'OPERATIONS_ENGINEER',
        reason || 'Resolved via operations console'
      );
      res.status(200).json({
        success: true,
        alert: resolved,
        correlationId: req.correlationId,
      });
    } catch (err: any) {
      res.status(404).json({
        error: err.message || 'Alert not found',
        correlationId: req.correlationId,
      });
    }
  }

  /**
   * Triggers on-demand sweep for stuck transactions
   */
  public static async triggerStuckSweep(req: Request, res: Response): Promise<void> {
    const summary = await StuckTransactionMonitor.scanForStuckTransactions();
    res.status(200).json({
      success: true,
      summary,
      correlationId: req.correlationId,
    });
  }
}
