import crypto from 'crypto';
import {
  OnRampProvider,
  CreateOrderParams,
  OnRampOrderResult,
  OrderStatusResult,
  CancelOrderResult,
  ParsedWebhookEvent,
  ProviderAuditVerification,
} from './onramp-provider.interface';

/**
 * MoneyGram On-Ramp Adapter
 *
 * Official Documentation Verification:
 * - Developer Portal: developer.moneygram.com / stellar.org/learn/moneygram-access
 * - Architecture: Stellar SEP-24 interactive deposit/withdrawal & REST Partner API
 * - Sandbox: Yes (Stellar Testnet + MoneyGram Sandbox Agent POS)
 * - Midnight Support: NONE
 * - Preview Support: NONE
 * - Supported Fiat: USD, EUR, GBP, CAD, AUD, MXN, PHP, BRL, and 180+ corridor currencies
 * - Supported Assets: Stellar USDC (Native tDUST is NOT supported)
 * - Supported Countries: 180+ retail agent countries (US, GB, DE, FR, IT, ES, CA, MX, PH, etc.)
 * - Payment Methods: CASH_AGENT (Retail store cash deposit), DEBIT_CARD, BANK_TRANSFER
 * - Webhook Support: Yes (HMAC-SHA256 signed event callbacks)
 *
 * STATUS: BLOCKED.
 * Technical Rationale: MoneyGram has no native integration with Midnight Preview.
 * It cannot mint or settle tDUST, nor does it support Compact smart contract proofs.
 */
export class MoneyGramOnRampAdapter implements OnRampProvider {
  public readonly providerName = 'MONEYGRAM';
  public readonly isBlocked = true;
  public readonly blockedReason =
    'MoneyGram Access operates via Stellar SEP-24 rails (issuing Stellar USDC) and retail agent cash counters. It has NO native Midnight Preview RPC integration, NO tDUST liquidity or minting capability, and CANNOT interact with Compact smart contracts. Direct on-ramp to Midnight Preview is BLOCKED.';

  private webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.MONEYGRAM_WEBHOOK_SECRET || 'dev_moneygram_secret_key';
  }

  public getAuditVerification(): ProviderAuditVerification {
    return {
      provider: this.providerName,
      apiAccess: true, // Official REST & SEP-24 APIs exist
      sandboxAvailable: true, // Sandbox available via Stellar Testnet
      midnightSupport: false, // Midnight has zero integration
      preprodSupport: false, // No Preprod tDUST rail
      previewSupport: false, // No Preview tDUST rail
      supportedFiat: this.getSupportedFiatCurrencies(),
      supportedAssets: this.getSupportedAssets(), // ['USDC_STELLAR'] — tDUST unsupported
      supportedCountries: this.getSupportedCountries(),
      paymentMethods: this.getSupportedPaymentMethods(),
      webhookSupport: true,
      isBlocked: this.isBlocked,
      blockedReason: this.blockedReason,
    };
  }

  public async createOrder(params: CreateOrderParams): Promise<OnRampOrderResult> {
    if (this.isBlocked) {
      const error = new Error(
        `[MoneyGramOnRampAdapter] Cannot execute on-ramp order: Provider is BLOCKED for Midnight Preview. Rationale: ${this.blockedReason}`
      );
      (error as any).code = 'PROVIDER_BLOCKED';
      (error as any).provider = this.providerName;
      throw error;
    }

    const orderId = `mg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      orderId,
      providerOrderId: `mg_tx_${Date.now()}`,
      status: 'CREATED',
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency,
      cryptoAmount: params.cryptoAmount || '0.00',
      cryptoAsset: params.cryptoAsset || 'tDUST',
      destinationWallet: params.destinationWallet,
      paymentUrl: `https://sandbox.moneygram.com/checkout/${orderId}`,
      createdAt: new Date(),
    };
  }

  public async getOrderStatus(orderId: string): Promise<OrderStatusResult> {
    return {
      providerOrderId: orderId,
      status: 'FAILED',
      fiatReceived: false,
      rawStatus: 'BLOCKED_UNSUPPORTED_NETWORK',
      updatedAt: new Date(),
    };
  }

  public async cancelOrder(orderId: string): Promise<CancelOrderResult> {
    return {
      providerOrderId: orderId,
      status: 'CANCELLED',
      reason: 'Order cancelled due to unsupported settlement rail',
    };
  }

  public verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string | Buffer
  ): boolean {
    const signature = headers['x-moneygram-signature'] || headers['x-mg-signature'];
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    try {
      const payloadString = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : String(rawPayload);
      const computed = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'));
    } catch {
      return false;
    }
  }

  public parseWebhook(payload: unknown): ParsedWebhookEvent {
    const data = payload as any;
    const rawStatus = data?.status || data?.event_type || 'UNKNOWN';

    let normalizedStatus: any = 'PAYMENT_PENDING';
    if (['COMPLETED', 'settled', 'success'].includes(rawStatus)) {
      normalizedStatus = 'PAYMENT_CONFIRMED';
    } else if (['FAILED', 'rejected', 'error'].includes(rawStatus)) {
      normalizedStatus = 'FAILED';
    } else if (['EXPIRED', 'timed_out'].includes(rawStatus)) {
      normalizedStatus = 'EXPIRED';
    } else if (['CANCELLED', 'refunded'].includes(rawStatus)) {
      normalizedStatus = 'CANCELLED';
    }

    return {
      providerOrderId: data?.transaction_id || data?.id || `mg_evt_${Date.now()}`,
      merchantOrderId: data?.external_reference || data?.order_id,
      eventType: data?.event_type || rawStatus,
      status: normalizedStatus,
      amount: data?.amount?.toString(),
      currency: data?.currency,
      timestamp: data?.timestamp ? new Date(data.timestamp) : new Date(),
      rawEvent: payload,
    };
  }

  public getSupportedFiatCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'PHP', 'BRL', 'INR', 'JPY'];
  }

  public getSupportedAssets(): string[] {
    // Official MoneyGram Access crypto asset is Stellar USDC only.
    // tDUST is explicitly NOT supported by MoneyGram.
    return ['USDC_STELLAR'];
  }

  public getSupportedCountries(): string[] {
    return ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'MX', 'PH', 'BR', 'IN', 'KE'];
  }

  public getSupportedPaymentMethods(): string[] {
    return ['CASH_AGENT', 'DEBIT_CARD', 'BANK_TRANSFER'];
  }
}
