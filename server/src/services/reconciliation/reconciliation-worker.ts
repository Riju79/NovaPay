import { ThreeWayReconciliationService } from './three-way-reconciliation.service';

/**
 * Background Reconciliation Job Worker
 * Periodically sweeps active remittances and cross-verifies DB, Provider, and Midnight Preview states.
 */
export class ReconciliationWorker {
  private static intervalTimer: NodeJS.Timeout | null = null;
  public static isRunning = false;
  public static lastRunAt: Date | null = null;
  public static lastRunResult: {
    sweptCount: number;
    matchedCount: number;
    exceptionCount: number;
  } | null = null;

  /**
   * Run a single reconciliation sweep job
   */
  public static async runJob(): Promise<{
    sweptCount: number;
    matchedCount: number;
    exceptionCount: number;
  }> {
    this.isRunning = true;
    try {
      const result = await ThreeWayReconciliationService.runAutomaticReconciliationSweep();
      this.lastRunAt = new Date();
      this.lastRunResult = {
        sweptCount: result.sweptCount,
        matchedCount: result.matchedCount,
        exceptionCount: result.exceptionCount,
      };
      return this.lastRunResult;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start recurring background cron/timer
   */
  public static startWorker(intervalMs: number = 60000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.runJob().catch((err) => {
        console.error('[ReconciliationWorker] Background reconciliation sweep error:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop background cron/timer
   */
  public static stopWorker(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
