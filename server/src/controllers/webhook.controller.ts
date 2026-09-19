import { Request, Response } from 'express';
import { WebhookService } from '../services/webhook/webhook.service';

/**
 * Controller for Secure Provider Webhook Infrastructure (Phase 13)
 */
export class WebhookController {
  /**
   * POST /api/webhooks/:provider
   * Ingest, verify signature/timestamp, deduplicate, persist, and process webhook.
   */
  public static async handleIncomingWebhook(req: Request, res: Response): Promise<Response> {
    const { provider } = req.params;
    const rawPayload = (req as any).rawBody || JSON.stringify(req.body);

    try {
      const result = await WebhookService.processIncomingWebhook(
        provider,
        req.headers,
        rawPayload,
        req.body
      );

      if (result.duplicate) {
        return res.status(200).json({
          received: true,
          duplicate: true,
          status: 'DUPLICATE',
          message: 'Duplicate event ignored',
          eventId: result.eventId,
        });
      }

      if (!result.success) {
        return res.status(422).json({
          received: true,
          status: 'FAILED',
          eventId: result.eventId,
          error: result.error,
        });
      }

      return res.status(200).json({
        received: true,
        status: 'PROCESSED',
        eventId: result.eventId,
        result: result.domainResult,
      });
    } catch (err: any) {
      if (err.code === 'INVALID_WEBHOOK_SIGNATURE') {
        return res.status(401).json({ error: err.message, code: 'INVALID_WEBHOOK_SIGNATURE' });
      }
      if (err.code === 'STALE_WEBHOOK_TIMESTAMP') {
        return res.status(400).json({ error: err.message, code: 'STALE_WEBHOOK_TIMESTAMP' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/webhooks/events
   * Query in-memory and database webhook events.
   */
  public static async listEvents(req: Request, res: Response): Promise<Response> {
    try {
      const events = Array.from(WebhookService.memoryEvents.values());
      return res.json({
        success: true,
        events,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/webhooks/events/:id/retry
   * Retry a failed webhook event.
   */
  public static async retryEvent(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const retried = await WebhookService.retryWebhookEvent(id);
      return res.json({
        success: true,
        event: retried,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
}
