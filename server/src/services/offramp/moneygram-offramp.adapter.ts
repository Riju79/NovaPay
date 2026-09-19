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
 * MoneyGram Off-Ramp Adapter
 *
 * Official Documentation Verification:
 * - Developer Portal: developer.moneygram.com / stellar.org/learn/moneygram-access
 * - Architecture: Stellar SEP-24 interactive withdrawal & REST Partner Disbursement API
 * - Sandbox: Yes (Stellar Testnet + MoneyGram Agent POS simulator)
 * - Midnight Support: NONE
 * - Preview Support: NONE
 * - Supported Fiat: USD, EUR, GBP, CAD, AUD, MXN, PHP, BRL, INR, and 180+ local currencies
 * - Supported Assets: Stellar USDC only (Native tDUST is NOT supported)
 * - Supported Countries: 180+ destination countries with 400,000+ retail agent counters
 * - Supported Payout Methods: CASH_PICKUP (Retail store cash disbursement), BANK_DEPOSIT, MOBILE_WALLET
 * - Webhook Support: Yes (HMAC-SHA256 signed event callbacks)
 *
 * STATUS: BLOCKED.
 * Technical Rationale: MoneyGram Access off-ramping (withdrawals) operates exclusively
 * by receiving Stellar USDC into an anchor Stellar address and releasing cash at agent locations.
 * It has NO native Midnight Preview RPC, cannot escrow or burn tDUST, and cannot verify Compact smart contracts.
 * Direct off-ramping from Midnight Preview is BLOCKED.
 */
export class MoneyGramOffRampAdapter implements OffRampProvider {
  public readonly providerName = 'MONEYGRAM';
  public readonly isBlocked = true;
  public readonly blockedReason =
    'MoneyGram Access off-ramping operates via Stellar SEP-24 interactive withdrawal rails (accepting Stellar USDC). It has NO native Midnight Preview RPC connection, CANNOT accept, escrow, or burn tDUST, and CANNOT verify Compact privacy circuits. Direct off-ramp from Midnight Preview is BLOCKED.';

  private webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.MONEYGRAM_WEBHOOK_SECRET || 'dev_moneygram_secret_key';
  }

  public getAuditVerification(): OffRampProviderAuditVerification {
    return {
      provider: this.providerName,
      apiAccess: true, // Official REST & SEP-24 APIs exist
      sandboxAvailable: true, // Stellar testnet + POS simulator
      midnightSupport: false, // Zero Midnight integration
      preprodSupport: false, // No Preprod tDUST rail
      previewSupport: false, // No Preview tDUST rail
      supportedFiat: this.getSupportedFiatCurrencies(),
      supportedAssets: this.getSupportedAssets(), // ['USDC_STELLAR']
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
        `[MoneyGramOffRampAdapter] Cannot execute off-ramp payout: Provider is BLOCKED for Midnight Preview. Rationale: ${this.blockedReason}`
      );
      (error as any).code = 'PROVIDER_BLOCKED';
      (error as any).provider = this.providerName;
      throw error;
    }

    const payoutId = `mg_payout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      payoutId,
      providerPayoutId: `mg_ref_${Date.now()}`,
      status: 'PAYOUT_PENDING',
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency,
      cryptoAmount: params.cryptoAmount,
      cryptoAsset: params.cryptoAsset || 'tDUST',
      recipientReference: `MG-${Math.floor(10000000 + Math.random() * 90000000)}`,
      pickupPin: `${Math.floor(1000 + Math.random() * 9000)}`,
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

  public parseWebhook(payload: unknown): ParsedOffRampWebhookEvent {
    const data = payload as any;
    const rawStatus = data?.status || data?.event_type || 'UNKNOWN';

    let normalizedStatus: any = 'PAYOUT_PROCESSING';
    if (['collected', 'paid_out', 'COMPLETED', 'settled', 'success'].includes(rawStatus)) {
      normalizedStatus = 'COMPLETED';
    } else if (['declined', 'FAILED', 'rejected', 'error'].includes(rawStatus)) {
      normalizedStatus = 'FAILED';
    } else if (['compliance_rejected', 'sanctions_blocked'].includes(rawStatus)) {
      normalizedStatus = 'REJECTED';
    } else if (['compliance_hold', 'flagged', 'review'].includes(rawStatus)) {
      normalizedStatus = 'MANUAL_REVIEW';
    } else if (['refunded', 'returned'].includes(rawStatus)) {
      normalizedStatus = 'REFUNDED';
    }

    return {
      providerPayoutId: data?.transaction_id || data?.payout_id || `mg_payout_evt_${Date.now()}`,
      merchantPayoutId: data?.external_reference || data?.order_id,
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

  public getSupportedCountries(): string[] {
    return ['US', 'GB', 'DE', 'FR', 'IT', 'ES', 'CA', 'AU', 'MX', 'PH', 'BR', 'IN', 'KE'];
  }

  public getSupportedPayoutMethods(): string[] {
    return ['CASH_PICKUP', 'BANK_DEPOSIT', 'MOBILE_WALLET'];
  }

  public getSupportedAssets(): string[] {
    // Official MoneyGram Access crypto asset is Stellar USDC only.
    // tDUST is explicitly NOT supported by MoneyGram.
    return ['USDC_STELLAR'];
  }
}
