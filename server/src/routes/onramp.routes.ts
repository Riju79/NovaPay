import { Router } from 'express';
import { OnRampController } from '../controllers/onramp.controller';
import { authenticateToken } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

// Public / audit routes
router.get('/providers', OnRampController.getProviders as any);

// Order lifecycle
router.post('/orders', authenticateToken as any, idempotencyMiddleware as any, OnRampController.createOrder as any);
router.get('/orders/:id', authenticateToken as any, OnRampController.getOrder as any);
router.post('/orders/:id/initiate', authenticateToken as any, OnRampController.initiatePayment as any);
router.post('/orders/:id/cancel', authenticateToken as any, OnRampController.cancelOrder as any);

// Security test route: Frontend attempt to declare payment confirmed (strictly forbidden!)
router.post('/orders/:id/confirm', authenticateToken as any, OnRampController.confirmPaymentByFrontend as any);

// Provider Webhook callback
router.post('/webhook/:provider', OnRampController.handleWebhook as any);

export default router;
