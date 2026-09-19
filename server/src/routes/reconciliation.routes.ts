import { Router } from 'express';
import { ReconciliationController } from '../controllers/reconciliation.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Run on-demand automatic sweep
router.post('/sweep', authenticateToken as any, ReconciliationController.runSweep as any);

// Exception queue for manual review
router.get('/exceptions', authenticateToken as any, ReconciliationController.getExceptions as any);

// Individual record query, retry, and resolution
router.get('/:id', authenticateToken as any, ReconciliationController.getRecord as any);
router.post('/:id/retry', authenticateToken as any, ReconciliationController.retryRecord as any);
router.post('/:id/resolve', authenticateToken as any, ReconciliationController.resolveRecord as any);

export default router;
