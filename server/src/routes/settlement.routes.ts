import { Router } from 'express';
import { SettlementController } from '../controllers/settlement.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Run end-to-end settlement pipeline
router.post('/execute', authenticateToken as any, SettlementController.executeSettlement as any);

// Query settlement pipeline logs & status
router.get('/:id', authenticateToken as any, SettlementController.getSettlement as any);

// Query reconciliation report
router.get('/reconciliation/:reconId', authenticateToken as any, SettlementController.getReconciliation as any);

export default router;
