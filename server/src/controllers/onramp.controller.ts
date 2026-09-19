import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OnRampService } from '../services/onramp/onramp.service';

/**
 * Controller for On-Ramp Infrastructure (Phase 10)
 */
export class OnRampController {
  /**
   * GET /api/onramp/providers
   * Returns verification audit of all locked on-ramp providers.
   */
  public static async getProviders(req: Request, res: Response): Promise<Response> {
    try {
      const verifications = OnRampService.getProviderVerifications();
      return res.json({
        success: true,
        providers: verifications,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/onramp/orders
   * Create an on-ramp order in CREATED state.
   */
  public static async createOrder(req: AuthRequest, res: Response): Promise<Response> {
    const {
      provider = 'WORLDPAY',
      fiatAmount,
      fiatCurrency,
      cryptoAsset = 'tDUST',
      cryptoAmount,
      destinationWallet,
      paymentMethod = 'CREDIT_CARD',
      idempotencyKey,
    } = req.body;

    const userId = req.userId || 'anonymous-user';

    if (!fiatAmount || !fiatCurrency || !destinationWallet) {
      return res.status(400).json({
        error: 'Missing required parameters: fiatAmount, fiatCurrency, and destinationWallet are required.',
      });
    }

    try {
      const order = await OnRampService.createOrder(provider, {
        userId,
        fiatAmount: String(fiatAmount),
        fiatCurrency: String(fiatCurrency),
        cryptoAsset: String(cryptoAsset),
        cryptoAmount: cryptoAmount ? String(cryptoAmount) : undefined,
        destinationWallet: String(destinationWallet),
        paymentMethod: String(paymentMethod),
        idempotencyKey,
      });

      return res.status(201).json({
        success: true,
        order,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
  }

  /**
   * GET /api/onramp/orders/:id
   * Get on-ramp order status and audit trail.
   */
  public static async getOrder(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const order = await OnRampService.getOrder(id);
      return res.json({
        success: true,
        order,
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  }

  /**
   * POST /api/onramp/orders/:id/initiate
   * Attempts to initiate payment. Fails with PROVIDER_BLOCKED if provider lacks Midnight rail.
   */
  public static async initiatePayment(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const order = await OnRampService.initiatePayment(id);
      return res.json({
        success: true,
        order,
      });
    } catch (err: any) {
      if (err.code === 'PROVIDER_BLOCKED') {
        return res.status(422).json({
          error: err.message,
          code: 'PROVIDER_BLOCKED',
          blockedReason: err.blockedReason,
        });
      }
      return res.status(400).json({ error: err.message, code: err.code });
    }
  }

  /**
   * POST /api/onramp/orders/:id/confirm
   * Anti-Bypass Check: Frontend attempting to confirm payment directly is strictly forbidden!
   */
  public static async confirmPaymentByFrontend(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      // Intentionally passing source: 'FRONTEND' to trigger security enforcement
      await OnRampService.transitionOrder(id, 'PAYMENT_CONFIRMED', {
        source: 'FRONTEND',
        reason: 'Client attempted direct payment confirmation',
      });
      return res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'UNAUTHORIZED_PAYMENT_CONFIRMATION') {
        return res.status(403).json({
          error: err.message,
          code: 'UNAUTHORIZED_PAYMENT_CONFIRMATION',
          securityPolicy: 'Never trust frontend payment confirmation. Settlement requires authoritative webhook or backend confirmation.',
        });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  /**
   * POST /api/onramp/orders/:id/cancel
   * Cancel an order in CREATED or PAYMENT_PENDING state.
   */
  public static async cancelOrder(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    try {
      const order = await OnRampService.cancelOrder(id, 'USER', reason);
      return res.json({
        success: true,
        order,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
  }

  /**
   * POST /api/onramp/webhook/:provider
   * Ingest, verify, and process provider webhooks.
   */
  public static async handleWebhook(req: Request, res: Response): Promise<Response> {
    const { provider } = req.params;
    const rawPayload = (req as any).rawBody || JSON.stringify(req.body);

    try {
      const result = await OnRampService.handleWebhook(provider, req.headers, rawPayload, req.body);
      return res.json({
        received: true,
        result,
      });
    } catch (err: any) {
      if (err.code === 'INVALID_WEBHOOK_SIGNATURE') {
        return res.status(401).json({ error: err.message, code: 'INVALID_WEBHOOK_SIGNATURE' });
      }
      return res.status(400).json({ error: err.message });
    }
  }
}
