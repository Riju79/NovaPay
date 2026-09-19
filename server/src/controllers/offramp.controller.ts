import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OffRampService } from '../services/offramp/offramp.service';

/**
 * Controller for Off-Ramp Infrastructure (Phase 11)
 */
export class OffRampController {
  /**
   * GET /api/offramp/providers
   * Returns verification audit of all locked off-ramp payout providers.
   */
  public static async getProviders(req: Request, res: Response): Promise<Response> {
    try {
      const verifications = OffRampService.getProviderVerifications();
      return res.json({
        success: true,
        providers: verifications,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/offramp/orders
   * Create an off-ramp payout order in CREATED state.
   */
  public static async createOrder(req: AuthRequest, res: Response): Promise<Response> {
    const {
      provider = 'MONEYGRAM',
      cryptoAmount,
      cryptoAsset = 'tDUST',
      fiatAmount,
      fiatCurrency,
      sourceWallet,
      payoutMethod = 'CASH_PICKUP',
      recipientInfo,
      idempotencyKey,
    } = req.body;

    const userId = req.userId || 'anonymous-user';

    if (!cryptoAmount || !fiatAmount || !fiatCurrency || !sourceWallet || !recipientInfo?.fullName) {
      return res.status(400).json({
        error: 'Missing required parameters: cryptoAmount, fiatAmount, fiatCurrency, sourceWallet, and recipientInfo are required.',
      });
    }

    try {
      const order = await OffRampService.createOrder(provider, {
        userId,
        cryptoAmount: String(cryptoAmount),
        cryptoAsset: String(cryptoAsset),
        fiatAmount: String(fiatAmount),
        fiatCurrency: String(fiatCurrency),
        sourceWallet: String(sourceWallet),
        payoutMethod: String(payoutMethod),
        recipientInfo,
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
   * GET /api/offramp/orders/:id
   * Get off-ramp order status and audit trail.
   */
  public static async getOrder(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const order = await OffRampService.getOrder(id);
      return res.json({
        success: true,
        order,
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  }

  /**
   * POST /api/offramp/orders/:id/confirm-asset
   * Authoritative confirmation of on-chain tDUST transfer.
   */
  public static async confirmAsset(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { txHash, blockHeight } = req.body;

    if (!txHash) {
      return res.status(400).json({ error: 'txHash is required' });
    }

    try {
      const order = await OffRampService.confirmAssetReceived(id, txHash, blockHeight);
      return res.json({
        success: true,
        order,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
  }

  /**
   * POST /api/offramp/orders/:id/initiate-payout
   * Dispatch payout to provider. Fails with PROVIDER_BLOCKED if provider lacks Midnight settlement rail.
   */
  public static async initiatePayout(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      const order = await OffRampService.initiatePayout(id);
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
   * POST /api/offramp/orders/:id/complete
   * Anti-Bypass Check: Frontend attempting to declare payout completion directly is strictly forbidden!
   */
  public static async completePayoutByFrontend(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    try {
      // Passing source: 'FRONTEND' to trigger security enforcement
      await OffRampService.transitionOrder(id, 'COMPLETED', {
        source: 'FRONTEND',
        reason: 'Client attempted direct payout completion declaration',
      });
      return res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'UNAUTHORIZED_PAYOUT_COMPLETION') {
        return res.status(403).json({
          error: err.message,
          code: 'UNAUTHORIZED_PAYOUT_COMPLETION',
          securityPolicy: 'Never let frontend declare payout completion. Provider status must be independently verified.',
        });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  /**
   * POST /api/offramp/orders/:id/cancel
   * Cancel an unfulfilled off-ramp order.
   */
  public static async cancelOrder(req: AuthRequest, res: Response): Promise<Response> {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    try {
      const order = await OffRampService.cancelOrder(id, reason);
      return res.json({
        success: true,
        order,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
  }

  /**
   * POST /api/offramp/webhook/:provider
   * Ingest, verify, and process provider payout webhooks.
   */
  public static async handleWebhook(req: Request, res: Response): Promise<Response> {
    const { provider } = req.params;
    const rawPayload = (req as any).rawBody || JSON.stringify(req.body);

    try {
      const result = await OffRampService.handleWebhook(provider, req.headers, rawPayload, req.body);
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
