import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Ingest webhook (unauthenticated endpoint with cryptographic signature verification)
router.post('/:provider', WebhookController.handleIncomingWebhook as any);

// Internal management endpoints (authenticated)
router.get('/events', authenticateToken as any, WebhookController.listEvents as any);
router.post('/events/:id/retry', authenticateToken as any, WebhookController.retryEvent as any);

export default router;
