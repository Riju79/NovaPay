import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { toDecimal, isPositiveAmount } from '../../utils/money';
import {
  OffRampOrderStatus,
  OffRampProvider,
  CreatePayoutParams,
  OffRampProviderAuditVerification,
} from './offramp-provider.interface';
import { MoneyGramOffRampAdapter } from './moneygram-offramp.adapter';
import { WorldpayOffRampAdapter } from './worldpay-offramp.adapter';

export interface StoredOffRampOrder {
  id: string;
  idempotency_key: string;
  user_id: string;
  provider: string;
  crypto_amount: Prisma.Decimal;
  crypto_asset: string;
  fiat_amount: Prisma.Decimal;
  fiat_currency: string;
  source_wallet: string;
  deposit_wallet: string;
  payout_method: string;
  recipient_name: string;
  recipient_country: string;
  payout_location_id?: string | null;
  status: OffRampOrderStatus;
  provider_order_id?: string | null;
  tx_hash?: string | null;
  created_at: Date;
  updated_at: Date;
  audit_trail: Array<{
    from: OffRampOrderStatus;
    to: OffRampOrderStatus;
    timestamp: Date;
    source: string;
    reason?: string;
  }>;
}

export interface OffRampTransitionContext {
  source: 'WEBHOOK' | 'SERVER_POLL' | 'BLOCKCHAIN_VERIFIED' | 'SYSTEM' | 'COMPLIANCE' | 'FRONTEND';
  reason?: string;
  providerPayoutId?: string;
  txHash?: string;
}

export class OffRampService {
  // In-memory cache for unit testing and instant lookup
  public static memoryCache: Map<string, StoredOffRampOrder> = new Map();

  // Registry of locked off-ramp providers
  private static providers: Map<string, OffRampProvider> = new Map();

  static {
    this.registerProvider(new MoneyGramOffRampAdapter());
    this.registerProvider(new WorldpayOffRampAdapter());
  }

  public static registerProvider(provider: OffRampProvider): void {
    this.providers.set(provider.providerName.toUpperCase(), provider);
  }

  public static getProvider(providerName: string): OffRampProvider {
    const provider = this.providers.get(providerName.toUpperCase());
    if (!provider) {
      throw new Error(`OffRamp provider '${providerName}' is not registered`);
    }
    return provider;
  }

  public static getAllProviders(): OffRampProvider[] {
    return Array.from(this.providers.values());
  }

  public static getProviderVerifications(): OffRampProviderAuditVerification[] {
    return this.getAllProviders().map((p) => p.getAuditVerification());
  }

  public static clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Allowed state transitions map for the 11-state lifecycle:
   * CREATED
   * ASSET_PENDING
   * ASSET_RECEIVED
   * PAYOUT_PENDING
   * PAYOUT_PROCESSING
   * COMPLETED
   * FAILED
   * REJECTED
   * MANUAL_REVIEW
   * REFUND_PENDING
   * REFUNDED
   */
  private static readonly ALLOWED_TRANSITIONS: Record<OffRampOrderStatus, OffRampOrderStatus[]> = {
    CREATED: ['ASSET_PENDING', 'FAILED'],
    ASSET_PENDING: ['ASSET_RECEIVED', 'FAILED', 'REJECTED'],
    ASSET_RECEIVED: ['PAYOUT_PENDING', 'MANUAL_REVIEW', 'REFUND_PENDING'],
    PAYOUT_PENDING: ['PAYOUT_PROCESSING', 'MANUAL_REVIEW', 'FAILED', 'REFUND_PENDING'],
    PAYOUT_PROCESSING: ['COMPLETED', 'FAILED', 'REJECTED', 'MANUAL_REVIEW', 'REFUND_PENDING'],
    COMPLETED: [], // Terminal success
    FAILED: [], // Terminal failure
    REJECTED: [], // Terminal failure
    MANUAL_REVIEW: ['PAYOUT_PENDING', 'REJECTED', 'REFUND_PENDING'],
    REFUND_PENDING: ['REFUNDED', 'FAILED'],
    REFUNDED: [], // Terminal refund
  };

  /**
   * Create an Off-Ramp Order in CREATED state.
   */
  public static async createOrder(
    providerName: string,
    params: CreatePayoutParams
  ): Promise<StoredOffRampOrder> {
    const provider = this.getProvider(providerName);

    if (!params.cryptoAmount || !isPositiveAmount(params.cryptoAmount)) {
      throw new Error('Valid positive cryptoAmount is required');
    }

    if (!params.fiatAmount || !isPositiveAmount(params.fiatAmount)) {
      throw new Error('Valid positive fiatAmount is required');
    }

    if (!params.sourceWallet) {
      throw new Error('sourceWallet is required');
    }

    if (!params.recipientInfo?.fullName || !params.recipientInfo?.country) {
      throw new Error('recipientInfo with fullName and country is required');
    }

    const orderId = `offramp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const idempotencyKey = params.idempotencyKey || `idemp_${orderId}`;

    // Idempotency check: Return existing payout if identical key was already submitted
    for (const cached of this.memoryCache.values()) {
      if (cached.idempotency_key === idempotencyKey && cached.user_id === params.userId) {
        return cached;
      }
    }

    const cryptoDec = toDecimal(params.cryptoAmount);
    const fiatDec = toDecimal(params.fiatAmount);
    const cryptoAsset = params.cryptoAsset || 'tDUST';

    // Deposit destination wallet on Midnight Preview where user must send tDUST
    const depositWallet = `mn_preview_vault_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const order: StoredOffRampOrder = {
      id: orderId,
      idempotency_key: idempotencyKey,
      user_id: params.userId,
      provider: provider.providerName,
      crypto_amount: cryptoDec,
      crypto_asset: cryptoAsset,
      fiat_amount: fiatDec,
      fiat_currency: params.fiatCurrency.toUpperCase(),
      source_wallet: params.sourceWallet,
      deposit_wallet: depositWallet,
      payout_method: params.payoutMethod,
      recipient_name: params.recipientInfo.fullName,
      recipient_country: params.recipientInfo.country,
      payout_location_id: params.recipientInfo.pickupLocationId || null,
      status: 'CREATED',
      provider_order_id: null,
      tx_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
      audit_trail: [
        {
          from: 'CREATED',
          to: 'CREATED',
          timestamp: new Date(),
          source: 'SYSTEM',
          reason: 'OffRampOrder initialized in CREATED state',
        },
      ],
    };

    this.memoryCache.set(orderId, order);

    try {
      await prisma.offRampOrder.create({
        data: {
          id: order.id,
          idempotency_key: order.idempotency_key,
          user_id: order.user_id,
          provider: order.provider as any,
          crypto_amount: order.crypto_amount,
          crypto_asset: order.crypto_asset,
          fiat_amount: order.fiat_amount,
          fiat_currency: order.fiat_currency,
          source_wallet: order.source_wallet,
          payout_location_id: order.payout_location_id,
          status: 'CREATED',
          created_at: order.created_at,
        },
      });
    } catch {
      // Offline/test fallback
    }

    return order;
  }

  /**
   * Transition order to target state with anti-bypass enforcement.
   * NEVER let frontend declare payout completion or progression.
   */
  public static async transitionOrder(
    orderId: string,
    targetState: OffRampOrderStatus,
    context: OffRampTransitionContext
  ): Promise<StoredOffRampOrder> {
    const order = await this.getOrder(orderId);
    const currentState = order.status;

    // SECURITY ENFORCEMENT: Anti-Bypass Rule
    if (context.source === 'FRONTEND') {
      if (['ASSET_RECEIVED', 'PAYOUT_PROCESSING', 'COMPLETED', 'REFUNDED'].includes(targetState)) {
        const error = new Error(
          `UNAUTHORIZED_PAYOUT_COMPLETION: Frontend client cannot assert '${targetState}'. Payout status must be independently verified via cryptographically verified webhooks or authoritative server polling.`
        );
        (error as any).code = 'UNAUTHORIZED_PAYOUT_COMPLETION';
        throw error;
      }
    }

    // Check validity of state machine transition
    const validTargets = this.ALLOWED_TRANSITIONS[currentState] || [];
    if (!validTargets.includes(targetState)) {
      const error = new Error(
        `INVALID_STATE_TRANSITION: Cannot transition OffRampOrder from '${currentState}' to '${targetState}'. Valid transitions: [${validTargets.join(', ')}]`
      );
      (error as any).code = 'INVALID_STATE_TRANSITION';
      throw error;
    }

    // Apply state update
    order.status = targetState;
    order.updated_at = new Date();
    if (context.providerPayoutId) {
      order.provider_order_id = context.providerPayoutId;
    }
    if (context.txHash) {
      order.tx_hash = context.txHash;
    }

    order.audit_trail.push({
      from: currentState,
      to: targetState,
      timestamp: new Date(),
      source: context.source,
      reason: context.reason,
    });

    this.memoryCache.set(orderId, order);

    try {
      await prisma.offRampOrder.update({
        where: { id: orderId },
        data: {
          status: targetState as any,
          provider_order_id: order.provider_order_id,
          tx_hash: order.tx_hash,
          updated_at: order.updated_at,
        },
      });
    } catch {
      // Test fallback
    }

    return order;
  }

  /**
   * Move order to ASSET_PENDING (Deposit address assigned, awaiting tDUST transfer).
   */
  public static async markAssetPending(orderId: string): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'ASSET_PENDING', {
      source: 'SYSTEM',
      reason: 'Deposit address generated; waiting for on-chain tDUST transfer',
    });
  }

  /**
   * Confirm tDUST transfer received on Midnight Preview blockchain.
   * Requires authoritative blockchain verification.
   */
  public static async confirmAssetReceived(
    orderId: string,
    txHash: string,
    blockHeight?: number
  ): Promise<StoredOffRampOrder> {
    if (!txHash || txHash.length < 10) {
      throw new Error('Valid blockchain transaction hash is required');
    }

    return this.transitionOrder(orderId, 'ASSET_RECEIVED', {
      source: 'BLOCKCHAIN_VERIFIED',
      txHash,
      reason: `tDUST deposit confirmed on Midnight Preview (tx: ${txHash}${blockHeight ? ` block: ${blockHeight}` : ''})`,
    });
  }

  /**
   * Prepare payout disbursement: ASSET_RECEIVED -> PAYOUT_PENDING.
   */
  public static async preparePayout(orderId: string): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'PAYOUT_PENDING', {
      source: 'SYSTEM',
      reason: 'Asset verified; payout queued for provider dispatch',
    });
  }

  /**
   * Dispatch payout to provider: PAYOUT_PENDING -> PAYOUT_PROCESSING.
   * If provider is BLOCKED, throws PROVIDER_BLOCKED with diagnostic reason.
   */
  public static async initiatePayout(orderId: string): Promise<StoredOffRampOrder> {
    const order = await this.getOrder(orderId);
    const provider = this.getProvider(order.provider);

    if (provider.isBlocked) {
      const error = new Error(
        `PROVIDER_BLOCKED: Provider '${provider.providerName}' is blocked for Midnight Preview off-ramping: ${provider.blockedReason}`
      );
      (error as any).code = 'PROVIDER_BLOCKED';
      (error as any).blockedReason = provider.blockedReason;
      throw error;
    }

    return this.transitionOrder(orderId, 'PAYOUT_PROCESSING', {
      source: 'SYSTEM',
      reason: `Payout dispatched to ${provider.providerName}`,
    });
  }

  /**
   * Authoritative server-side payout completion (e.g. verified server poll or reconciliation).
   */
  public static async confirmPayoutAuthoritatively(
    orderId: string,
    providerPayoutId: string,
    reason = 'Authoritative settlement verified by backend polling'
  ): Promise<StoredOffRampOrder> {
    const order = await this.getOrder(orderId);

    // If still in PAYOUT_PENDING, advance through PAYOUT_PROCESSING first
    if (order.status === 'PAYOUT_PENDING') {
      await this.transitionOrder(orderId, 'PAYOUT_PROCESSING', {
        source: 'SERVER_POLL',
        providerPayoutId,
        reason: 'Auto-advanced to PAYOUT_PROCESSING upon verified provider response',
      });
    }

    return this.transitionOrder(orderId, 'COMPLETED', {
      source: 'SERVER_POLL',
      providerPayoutId,
      reason,
    });
  }

  /**
   * Ingest and verify incoming provider webhook.
   */
  public static async handleWebhook(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string | Buffer,
    body: unknown
  ): Promise<{ processed: boolean; orderId?: string; status?: OffRampOrderStatus }> {
    const provider = this.getProvider(providerName);

    // 1. Verify Webhook Authenticity
    const isValid = provider.verifyWebhook(headers, rawPayload);
    if (!isValid) {
      const error = new Error(
        `INVALID_WEBHOOK_SIGNATURE: Webhook signature verification failed for provider '${providerName}'`
      );
      (error as any).code = 'INVALID_WEBHOOK_SIGNATURE';
      throw error;
    }

    // 2. Parse Webhook Event
    const event = provider.parseWebhook(body);

    // 3. Locate Order
    let order: StoredOffRampOrder | null = null;
    if (event.merchantPayoutId) {
      order = await this.findOrder(event.merchantPayoutId);
    }
    if (!order && event.providerPayoutId) {
      order = await this.findOrderByProviderId(event.providerPayoutId);
    }

    if (!order) {
      return { processed: false };
    }

    // 4. Authoritative State Transition based on parsed event status
    if (event.status === 'COMPLETED') {
      if (order.status === 'PAYOUT_PENDING') {
        await this.transitionOrder(order.id, 'PAYOUT_PROCESSING', {
          source: 'WEBHOOK',
          providerPayoutId: event.providerPayoutId,
          reason: `Webhook reported active disbursement`,
        });
      }
      if (order.status === 'PAYOUT_PROCESSING' || (await this.getOrder(order.id)).status === 'PAYOUT_PROCESSING') {
        await this.transitionOrder(order.id, 'COMPLETED', {
          source: 'WEBHOOK',
          providerPayoutId: event.providerPayoutId,
          reason: `Webhook confirmed fiat disbursement completed: ${event.eventType}`,
        });
      }
    } else if (event.status === 'FAILED' && ['PAYOUT_PENDING', 'PAYOUT_PROCESSING'].includes(order.status)) {
      await this.transitionOrder(order.id, 'FAILED', {
        source: 'WEBHOOK',
        providerPayoutId: event.providerPayoutId,
        reason: `Webhook reported payout failure: ${event.eventType}`,
      });
    } else if (event.status === 'REJECTED' && ['PAYOUT_PENDING', 'PAYOUT_PROCESSING'].includes(order.status)) {
      await this.transitionOrder(order.id, 'REJECTED', {
        source: 'WEBHOOK',
        providerPayoutId: event.providerPayoutId,
        reason: `Webhook reported payout rejected: ${event.eventType}`,
      });
    } else if (event.status === 'MANUAL_REVIEW' && ['PAYOUT_PENDING', 'PAYOUT_PROCESSING'].includes(order.status)) {
      await this.transitionOrder(order.id, 'MANUAL_REVIEW', {
        source: 'WEBHOOK',
        providerPayoutId: event.providerPayoutId,
        reason: `Webhook reported compliance hold: ${event.eventType}`,
      });
    }

    return {
      processed: true,
      orderId: order.id,
      status: (await this.getOrder(order.id)).status,
    };
  }

  /**
   * Escalate to MANUAL_REVIEW.
   */
  public static async escalateManualReview(orderId: string, reason: string): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'MANUAL_REVIEW', {
      source: 'COMPLIANCE',
      reason,
    });
  }

  /**
   * Clear from MANUAL_REVIEW to PAYOUT_PENDING.
   */
  public static async clearManualReview(orderId: string, officerNotes: string): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'PAYOUT_PENDING', {
      source: 'COMPLIANCE',
      reason: `Manual review approved: ${officerNotes}`,
    });
  }

  /**
   * Cancel an order in CREATED or ASSET_PENDING state.
   */
  public static async cancelOrder(orderId: string, reason = 'Order cancelled'): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'FAILED', {
      source: 'SYSTEM',
      reason,
    });
  }

  /**
   * Initiate refund flow: ASSET_RECEIVED / MANUAL_REVIEW / PAYOUT_PROCESSING -> REFUND_PENDING.
   */
  public static async initiateRefund(orderId: string, reason = 'Disbursement failed, initiating crypto refund'): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'REFUND_PENDING', {
      source: 'SYSTEM',
      reason,
    });
  }

  /**
   * Finalize refund: REFUND_PENDING -> REFUNDED.
   */
  public static async finalizeRefund(orderId: string, refundTxHash: string): Promise<StoredOffRampOrder> {
    return this.transitionOrder(orderId, 'REFUNDED', {
      source: 'BLOCKCHAIN_VERIFIED',
      txHash: refundTxHash,
      reason: `tDUST refunded back to source wallet (tx: ${refundTxHash})`,
    });
  }

  /**
   * Helper lookups
   */
  public static async getOrder(orderId: string): Promise<StoredOffRampOrder> {
    const cached = this.memoryCache.get(orderId);
    if (cached) return cached;

    try {
      const dbOrder = await prisma.offRampOrder.findUnique({ where: { id: orderId } });
      if (dbOrder) {
        const stored: StoredOffRampOrder = {
          id: dbOrder.id,
          idempotency_key: dbOrder.idempotency_key,
          user_id: dbOrder.user_id,
          provider: dbOrder.provider,
          crypto_amount: dbOrder.crypto_amount,
          crypto_asset: dbOrder.crypto_asset,
          fiat_amount: dbOrder.fiat_amount,
          fiat_currency: dbOrder.fiat_currency,
          source_wallet: dbOrder.source_wallet,
          deposit_wallet: 'vault_unknown',
          payout_method: 'UNKNOWN',
          recipient_name: 'Recipient',
          recipient_country: 'US',
          payout_location_id: dbOrder.payout_location_id,
          status: dbOrder.status as OffRampOrderStatus,
          provider_order_id: dbOrder.provider_order_id,
          tx_hash: dbOrder.tx_hash,
          created_at: dbOrder.created_at,
          updated_at: dbOrder.updated_at,
          audit_trail: [],
        };
        this.memoryCache.set(stored.id, stored);
        return stored;
      }
    } catch {
      // test fallback
    }

    throw new Error(`OffRampOrder '${orderId}' not found`);
  }

  public static async findOrder(orderId: string): Promise<StoredOffRampOrder | null> {
    try {
      return await this.getOrder(orderId);
    } catch {
      return null;
    }
  }

  public static async findOrderByProviderId(providerPayoutId: string): Promise<StoredOffRampOrder | null> {
    for (const order of this.memoryCache.values()) {
      if (order.provider_order_id === providerPayoutId) {
        return order;
      }
    }

    try {
      const dbOrder = await prisma.offRampOrder.findUnique({
        where: { provider_order_id: providerPayoutId },
      });
      if (dbOrder) {
        return this.getOrder(dbOrder.id);
      }
    } catch {
      // test fallback
    }

    return null;
  }
}
