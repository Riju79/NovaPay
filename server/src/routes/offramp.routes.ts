import { Router } from 'express';
import { OffRampController } from '../controllers/offramp.controller';
import { authenticateToken } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

// Provider audit directory
router.get('/providers', OffRampController.getProviders as any);

// Order lifecycle
router.post('/orders', authenticateToken as any, idempotencyMiddleware as any, OffRampController.createOrder as any);
router.get('/orders/:id', authenticateToken as any, OffRampController.getOrder as any);
router.post('/orders/:id/confirm-asset', authenticateToken as any, OffRampController.confirmAsset as any);
router.post('/orders/:id/initiate-payout', authenticateToken as any, OffRampController.initiatePayout as any);
router.post('/orders/:id/cancel', authenticateToken as any, OffRampController.cancelOrder as any);

// Security test route: Frontend attempt to declare payout completion (strictly forbidden!)
router.post('/orders/:id/complete', authenticateToken as any, OffRampController.completePayoutByFrontend as any);

// Provider Webhook callback
router.post('/webhook/:provider', OffRampController.handleWebhook as any);

export default router;
