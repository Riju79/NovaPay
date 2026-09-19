import crypto from 'crypto';
import {
  OffRampProvider,
  CreatePayoutParams,
  OffRampPayoutResult,
  PayoutStatusResult,
  CancelPayoutResult,
  ParsedOffRampWebhookEvent,
  OffRampProviderAuditVerification,
} from './offramp-provider.interface';

/**
 * Worldpay Off-Ramp Adapter
 *
 * Official Documentation Verification:
 * - Developer Portal: developer.worldpay.com (Worldpay Payouts / FastAccess Push to Card)
 * - Architecture: REST JSON Payouts API, Visa Direct / Mastercard Send OCT rails, Bank Disbursement
 * - Sandbox: Yes (Worldpay FastAccess Simulator)
 * - Midnight Support: NONE
 * - Preview Support: NONE
 * - Supported Fiat: USD, EUR, GBP, CAD, AUD, JPY, CHF, SGD, HKD, and 120+ settlement currencies
 * - Supported Assets: NONE native (Worldpay funds disbursements from merchant fiat accounts; zero tDUST support)
 * - Supported Countries: 100+ global recipient countries
 * - Supported Payout Methods: PUSH_TO_CARD (Visa Direct / Mastercard Send), BANK_ACCOUNT, SEPA_CREDIT_TRANSFER
 * - Webhook Support: Yes (HMAC-SHA256 signed event notifications)
 *
 * STATUS: BLOCKED.
 * Technical Rationale: Worldpay Payouts (FastAccess) disburses fiat funds from merchant fiat accounts
 * to cards or bank accounts. Worldpay has no connection to Midnight Network, cannot verify or receive
 * tDUST transactions, and cannot parse Midnight ZK proofs. Direct off-ramping from Midnight Preview is BLOCKED.
 */
export class WorldpayOffRampAdapter implements OffRampProvider {
  public readonly providerName = 'WORLDPAY';
  public readonly isBlocked = true;
  public readonly blockedReason =
    'Worldpay Payouts (FastAccess) dispatches fiat to cards (Visa Direct / Mastercard Send) or bank accounts. It has NO integration with Midnight Network, CANNOT accept, verify, or burn tDUST, and CANNOT parse Compact ZK proofs. Direct off-ramp from Midnight Preview is BLOCKED.';

  private webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.WORLDPAY_WEBHOOK_SECRET || 'dev_worldpay_webhook_secret';
  }

  public getAuditVerification(): OffRampProviderAuditVerification {
    return {
      provider: this.providerName,
      apiAccess: true, // Official REST Payout API available
      sandboxAvailable: true, // Worldpay simulator available
      midnightSupport: false, // Zero Midnight integration
      preprodSupport: false, // No Preprod tDUST rail
      previewSupport: false, // No Preview tDUST rail
      supportedFiat: this.getSupportedFiatCurrencies(),
      supportedAssets: this.getSupportedAssets(), // [] — tDUST unsupported
      supportedCountries: this.getSupportedCountries(),
      supportedPayoutMethods: this.getSupportedPayoutMethods(),
      webhookSupport: true,
      isBlocked: this.isBlocked,
      blockedReason: this.blockedReason,
    };
  }

  public async createPayout(params: CreatePayoutParams): Promise<OffRampPayoutResult> {
    if (this.isBlocked) {
      const error = new Error(
        `[WorldpayOffRampAdapter] Cannot execute off-ramp payout: Provider is BLOCKED for Midnight Preview. Rationale: ${this.blockedReason}`
      );
      (error as any).code = 'PROVIDER_BLOCKED';
      (error as any).provider = this.providerName;
      throw error;
    }

    const payoutId = `wp_payout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      payoutId,
      providerPayoutId: `wp_disb_${Date.now()}`,
      status: 'PAYOUT_PENDING',
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency,
      cryptoAmount: params.cryptoAmount,
      cryptoAsset: params.cryptoAsset || 'tDUST',
      recipientReference: `WP-FAST-${Math.floor(10000000 + Math.random() * 90000000)}`,
      createdAt: new Date(),
    };
  }

  public async getPayoutStatus(payoutId: string): Promise<PayoutStatusResult> {
    return {
      providerPayoutId: payoutId,
      status: 'FAILED',
      fiatDisbursed: false,
      rawStatus: 'BLOCKED_UNSUPPORTED_NETWORK',
      updatedAt: new Date(),
    };
  }

  public async cancelPayout(payoutId: string): Promise<CancelPayoutResult> {
    return {
      providerPayoutId: payoutId,
      status: 'CANCELLED',
      reason: 'Payout cancelled due to unsupported Midnight settlement rail',
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

  public parseWebhook(payload: unknown): ParsedOffRampWebhookEvent {
    const data = payload as any;
    const eventType = data?.event || data?.eventType || data?.status || 'UNKNOWN';

    let normalizedStatus: any = 'PAYOUT_PROCESSING';
    if (['disbursed', 'settled', 'COMPLETED', 'success', 'credited'].includes(eventType)) {
      normalizedStatus = 'COMPLETED';
    } else if (['declined', 'FAILED', 'card_error', 'account_invalid'].includes(eventType)) {
      normalizedStatus = 'FAILED';
    } else if (['compliance_rejected', 'sanctions_hit'].includes(eventType)) {
      normalizedStatus = 'REJECTED';
    } else if (['manual_review', 'under_review', 'hold'].includes(eventType)) {
      normalizedStatus = 'MANUAL_REVIEW';
    } else if (['refunded', 'returned'].includes(eventType)) {
      normalizedStatus = 'REFUNDED';
    }

    return {
      providerPayoutId: data?.payoutId || data?.id || `wp_payout_evt_${Date.now()}`,
      merchantPayoutId: data?.merchantReference || data?.orderId,
      eventType,
      status: normalizedStatus,
      amount: data?.amount ? (data.amount / 100).toFixed(2) : undefined,
      currency: data?.currencyCode || data?.currency,
      timestamp: data?.timestamp ? new Date(data.timestamp) : new Date(),
      rawEvent: payload,
    };
  }

  public getSupportedFiatCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK'];
  }

  public getSupportedCountries(): string[] {
    return ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SG', 'HK', 'JP', 'CA', 'AU', 'CH'];
  }

  public getSupportedPayoutMethods(): string[] {
    return ['PUSH_TO_CARD', 'BANK_ACCOUNT', 'SEPA_CREDIT_TRANSFER'];
  }

  public getSupportedAssets(): string[] {
    // Worldpay is a traditional fiat card and bank acquirer/disburser.
    // Zero native crypto assets supported.
    return [];
  }
}
