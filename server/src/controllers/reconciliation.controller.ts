import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ThreeWayReconciliationService } from '../services/reconciliation/three-way-reconciliation.service';
import { ReconciliationWorker } from '../services/reconciliation/reconciliation-worker';

/**
 * Controller for Three-Way Reconciliation Infrastructure (Phase 13)
 */
export class ReconciliationController {
  /**
   * POST /api/reconciliation/sweep
   * Triggers an automatic three-way reconciliation sweep across active transfers.
   */
  public static async runSweep(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const summary = await ReconciliationWorker.runJob();
      return res.json({
        success: true,
        summary,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/reconciliation/exceptions
   * Retrieves the exception queue requiring manual review.
   */
  public static async getExceptions(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const exceptions = await ThreeWayReconciliationService.getExceptionQueue();
      return res.json({
        success: true,
        count: exceptions.length,
        exceptions,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/reconciliation/:id
   * Get specific reconciliation record.
   */
  public static async getRecord(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const record = await ThreeWayReconciliationService.getRecord(id);
      return res.json({
        success: true,
        record,
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  }

  /**
   * POST /api/reconciliation/:id/retry
   * Retry reconciliation check for a desynchronized record.
   */
  public static async retryRecord(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const record = await ThreeWayReconciliationService.retryReconciliation(id);
      return res.json({
        success: true,
        record,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  /**
   * POST /api/reconciliation/:id/resolve
   * Manually resolve an exception with compliance/ops notes.
   */
  public static async resolveRecord(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    const { notes, status = 'RESOLVED' } = req.body;
    const officerId = req.userId || 'compliance-officer';

    if (!notes) {
      return res.status(400).json({ error: 'Resolution notes are required.' });
    }

    try {
      const record = await ThreeWayReconciliationService.resolveException(id, {
        officerId,
        notes,
        status,
      });

      return res.json({
        success: true,
        record,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
