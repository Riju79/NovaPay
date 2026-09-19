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
 * Worldpay On-Ramp Adapter
 *
 * Official Documentation Verification:
 * - Developer Portal: developer.worldpay.com (Worldpay Access / FIS)
 * - Architecture: REST JSON Payments API, 3D Secure 2 (3DS2), Tokenization
 * - Sandbox: Yes (Worldpay Access Simulator with sandbox test cards)
 * - Midnight Support: NONE
 * - Preview Support: NONE
 * - Supported Fiat: USD, EUR, GBP, CAD, AUD, JPY, CHF, SGD, HKD, and 120+ merchant currencies
 * - Supported Assets: NONE native (Worldpay settles in fiat currency; zero support for tDUST or Midnight)
 * - Supported Countries: 100+ global acquiring jurisdictions (US, GB, DE, FR, IT, ES, CA, SG, AU, etc.)
 * - Payment Methods: CREDIT_CARD, DEBIT_CARD, APPLE_PAY, GOOGLE_PAY, SEPA_DIRECT_DEBIT
 * - Webhook Support: Yes (HMAC-SHA256 authenticated event notifications)
 *
 * STATUS: BLOCKED.
 * Technical Rationale: Worldpay is a traditional fiat card acquirer. It does NOT interface
 * with Midnight Preview, cannot mint or distribute tDUST, and cannot verify Compact ZK proofs.
 */
export class WorldpayOnRampAdapter implements OnRampProvider {
  public readonly providerName = 'WORLDPAY';
  public readonly isBlocked = true;
  public readonly blockedReason =
    'Worldpay (FIS) is a traditional fiat payment acquirer (Visa, Mastercard, Amex, SEPA). It has NO integration with Midnight Network or Midnight Preview, NO capability to mint or deliver tDUST, and CANNOT verify Midnight Compact ZK proofs. Direct on-ramp to Midnight Preview is BLOCKED.';

  private webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.WORLDPAY_WEBHOOK_SECRET || 'dev_worldpay_webhook_secret';
  }

  public getAuditVerification(): ProviderAuditVerification {
    return {
      provider: this.providerName,
      apiAccess: true, // Official REST API available
      sandboxAvailable: true, // Worldpay Simulator available
      midnightSupport: false, // Zero Midnight integration
      preprodSupport: false, // No Preprod tDUST rail
      previewSupport: false, // No Preview tDUST rail
      supportedFiat: this.getSupportedFiatCurrencies(),
      supportedAssets: this.getSupportedAssets(), // [] — tDUST unsupported
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
        `[WorldpayOnRampAdapter] Cannot execute on-ramp order: Provider is BLOCKED for Midnight Preview. Rationale: ${this.blockedReason}`
      );
      (error as any).code = 'PROVIDER_BLOCKED';
      (error as any).provider = this.providerName;
      throw error;
    }

    const orderId = `wp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      orderId,
      providerOrderId: `wp_order_${Date.now()}`,
      status: 'CREATED',
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency,
      cryptoAmount: params.cryptoAmount || '0.00',
      cryptoAsset: params.cryptoAsset || 'tDUST',
      destinationWallet: params.destinationWallet,
      paymentUrl: `https://access.worldpay.com/hosted-payment/${orderId}`,
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
    const signature = headers['x-worldpay-signature'] || headers['x-wp-signature'];
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
    const eventType = data?.event || data?.outcome || data?.eventType || 'UNKNOWN';

    let normalizedStatus: any = 'PAYMENT_PENDING';
    if (['authorized', 'settled', 'PAYMENT_SUCCEEDED', 'success'].includes(eventType)) {
      normalizedStatus = 'PAYMENT_CONFIRMED';
    } else if (['refused', 'cancelled', 'FAILED', 'chargeback'].includes(eventType)) {
      normalizedStatus = 'FAILED';
    } else if (['expired', 'timeout'].includes(eventType)) {
      normalizedStatus = 'EXPIRED';
    } else if (['refunded', 'refund'].includes(eventType)) {
      normalizedStatus = 'REFUNDED';
    }

    return {
      providerOrderId: data?.paymentId || data?.id || `wp_evt_${Date.now()}`,
      merchantOrderId: data?.merchantReference || data?.orderId,
      eventType,
      status: normalizedStatus,
      amount: data?.amount ? (data.amount / 100).toFixed(2) : undefined, // Worldpay sends minor currency units (cents)
      currency: data?.currencyCode || data?.currency,
      timestamp: data?.timestamp ? new Date(data.timestamp) : new Date(),
      rawEvent: payload,
    };
  }

  public getSupportedFiatCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK'];
  }

  public getSupportedAssets(): string[] {
    // Worldpay is a traditional card acquirer with zero native crypto assets.
    // tDUST is completely unsupported.
    return [];
  }

  public getSupportedCountries(): string[] {
    return ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SG', 'HK', 'JP', 'CA', 'AU', 'CH'];
  }

  public getSupportedPaymentMethods(): string[] {
    return ['CREDIT_CARD', 'DEBIT_CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'SEPA_DIRECT_DEBIT'];
  }
}
