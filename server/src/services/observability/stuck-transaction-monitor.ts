/**
 * NovaPay Stuck Transaction Monitor
 * 
 * Periodically sweeps active remittances and off-ramp orders to identify
 * pipelines stuck in transient states past SLA limits:
 * - Remittance stuck in FUNDING_PENDING (> 30 minutes)
 * - Remittance stuck in BLOCKCHAIN_PENDING / BLOCKCHAIN_SUBMITTED (> 15 minutes)
 * - Remittance stuck in PAYOUT_PROCESSING (> 30 minutes)
 * - Off-Ramp order stuck in ASSET_PENDING (> 20 minutes)
 * - Off-Ramp order stuck in PAYOUT_PROCESSING (> 30 minutes)
 * 
 * Emits CRITICAL OperationalAlert and routes to exception handling.
 */

import { OperationalMonitoringService } from './operational-monitoring.service';
import { RemittanceService } from '../remittance/remittance.service';
import { OffRampService } from '../offramp/offramp.service';

export interface StuckScanSummary {
  scannedAt: string;
  remittancesScanned: number;
  stuckRemittancesFound: number;
  offRampOrdersScanned: number;
  stuckPayoutsFound: number;
  alertsCreated: number;
}

export class StuckTransactionMonitor {
  // Configurable SLA thresholds in minutes
  public static REMITTANCE_FUNDING_TIMEOUT_MINUTES = 30;
  public static REMITTANCE_BLOCKCHAIN_TIMEOUT_MINUTES = 15;
  public static REMITTANCE_PAYOUT_TIMEOUT_MINUTES = 30;
  public static OFFRAMP_ASSET_TIMEOUT_MINUTES = 20;
  public static OFFRAMP_PAYOUT_TIMEOUT_MINUTES = 30;

  private static sweepIntervalTimer: NodeJS.Timeout | null = null;

  /**
   * Executes an authoritative sweep across active remittances and off-ramp payouts.
   */
  public static async scanForStuckTransactions(): Promise<StuckScanSummary> {
    const now = Date.now();
    let stuckRemittances = 0;
    let stuckPayouts = 0;
    let alertsCreated = 0;

    // 1. Scan In-Memory & Active Remittances
    const remittances = Array.from(RemittanceService.memoryCache.values());
    for (const rem of remittances) {
      // Ignore terminal states
      if (['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'FAILED'].includes(rem.status)) {
        continue;
      }

      const updatedAtTime = new Date(rem.updated_at || rem.created_at).getTime();
      const ageMinutes = Math.floor((now - updatedAtTime) / (60 * 1000));

      let isStuck = false;
      let reason = '';

      if (rem.status === 'FUNDING_PENDING' && ageMinutes >= this.REMITTANCE_FUNDING_TIMEOUT_MINUTES) {
        isStuck = true;
        reason = `Remittance funding deposit timed out after ${ageMinutes}m`;
      } else if (
        ['BLOCKCHAIN_PENDING', 'BLOCKCHAIN_SUBMITTED'].includes(rem.status) &&
        ageMinutes >= this.REMITTANCE_BLOCKCHAIN_TIMEOUT_MINUTES
      ) {
        isStuck = true;
        reason = `Midnight Preview blockchain finality stalled after ${ageMinutes}m`;
      } else if (
        ['PAYOUT_PENDING', 'PAYOUT_PROCESSING'].includes(rem.status) &&
        ageMinutes >= this.REMITTANCE_PAYOUT_TIMEOUT_MINUTES
      ) {
        isStuck = true;
        reason = `Off-ramp provider payout confirmation stalled after ${ageMinutes}m`;
      }

      if (isStuck) {
        stuckRemittances++;
        const { alert } = OperationalMonitoringService.recordStuckRemittance(rem.id, rem.status, ageMinutes, {
          remittanceId: rem.id,
          quoteId: rem.quote_id,
          blockchainTransactionId: rem.blockchain_tx_hash || undefined,
          providerOrderId: rem.provider_reference || undefined,
          userId: rem.sender_id,
        });
        if (alert) alertsCreated++;
      }
    }

    // 2. Scan In-Memory & Active Off-Ramp Orders
    const offRamps = Array.from(OffRampService.memoryCache.values());
    for (const order of offRamps) {
      if (['COMPLETED', 'FAILED', 'REJECTED', 'REFUNDED'].includes(order.status)) {
        continue;
      }

      const updatedAtTime = new Date(order.updated_at || order.created_at).getTime();
      const ageMinutes = Math.floor((now - updatedAtTime) / (60 * 1000));

      let isStuck = false;
      let reason = '';

      if (order.status === 'ASSET_PENDING' && ageMinutes >= this.OFFRAMP_ASSET_TIMEOUT_MINUTES) {
        isStuck = true;
        reason = `Off-ramp deposit confirmation timed out after ${ageMinutes}m`;
      } else if (
        ['PAYOUT_PENDING', 'PAYOUT_PROCESSING'].includes(order.status) &&
        ageMinutes >= this.OFFRAMP_PAYOUT_TIMEOUT_MINUTES
      ) {
        isStuck = true;
        reason = `Provider cash disbursement delayed past SLA (${ageMinutes}m)`;
      }

      if (isStuck) {
        stuckPayouts++;
        const { alert } = OperationalMonitoringService.recordStuckPayout(order.id, order.status, ageMinutes, {
          providerOrderId: order.id,
          blockchainTransactionId: order.tx_hash || undefined,
          userId: order.user_id,
          walletAddress: order.source_wallet,
        });
        if (alert) alertsCreated++;
      }
    }

    return {
      scannedAt: new Date().toISOString(),
      remittancesScanned: remittances.length,
      stuckRemittancesFound: stuckRemittances,
      offRampOrdersScanned: offRamps.length,
      stuckPayoutsFound: stuckPayouts,
      alertsCreated,
    };
  }

  /**
   * Starts background recurring sweep worker
   */
  public static startBackgroundMonitor(intervalSeconds = 60): void {
    if (this.sweepIntervalTimer) return;
    this.sweepIntervalTimer = setInterval(() => {
      this.scanForStuckTransactions().catch(() => {});
    }, intervalSeconds * 1000);
  }

  /**
   * Stops background sweep worker
   */
  public static stopBackgroundMonitor(): void {
    if (this.sweepIntervalTimer) {
      clearInterval(this.sweepIntervalTimer);
      this.sweepIntervalTimer = null;
    }
  }
}
