/**
 * NovaPay Observability Routes
 */

import { Router } from 'express';
import { ObservabilityController } from '../controllers/observability.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public health and probe endpoints
router.get('/health', ObservabilityController.getHealth);
router.get('/health/live', ObservabilityController.getLiveness);
router.get('/health/ready', ObservabilityController.getReadiness);

// Operational metrics & alerts
router.get('/metrics', ObservabilityController.getMetrics);
router.get('/alerts', ObservabilityController.getAlerts);
router.post('/alerts/:id/resolve', authenticateToken, ObservabilityController.resolveAlert);
router.post('/stuck-sweep', authenticateToken, ObservabilityController.triggerStuckSweep);

export default router;
