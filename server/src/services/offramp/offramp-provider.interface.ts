/**
 * Phase 11 — Off-Ramp Provider Interface
 *
 * Defines the contract for all crypto-to-fiat payout / off-ramp providers.
 * Providers must strictly implement this interface.
 * If a provider lacks Midnight / tDUST settlement, it must declare isBlocked = true.
 */

export type OffRampOrderStatus =
  | 'CREATED'
  | 'ASSET_PENDING'
  | 'ASSET_RECEIVED'
  | 'PAYOUT_PENDING'
  | 'PAYOUT_PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'MANUAL_REVIEW'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface CreatePayoutParams {
  userId: string;
  cryptoAmount: string;
  cryptoAsset?: string;
  fiatAmount: string;
  fiatCurrency: string;
  sourceWallet: string;
  payoutMethod: string; // e.g. CASH_PICKUP, PUSH_TO_CARD, BANK_ACCOUNT
  recipientInfo: {
    fullName: string;
    email?: string;
    phone?: string;
    country: string;
    // For card payout
    cardNumber?: string;
    cardExpiry?: string;
    // For bank payout
    iban?: string;
    accountNumber?: string;
    routingNumber?: string;
    // For cash pickup
    pickupLocationId?: string;
  };
  idempotencyKey?: string;
}

export interface OffRampPayoutResult {
  payoutId: string;
  providerPayoutId: string;
  status: OffRampOrderStatus;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount: string;
  cryptoAsset: string;
  recipientReference?: string;
  pickupPin?: string;
  instructions?: Record<string, unknown>;
  createdAt: Date;
}

export interface PayoutStatusResult {
  providerPayoutId: string;
  status: OffRampOrderStatus;
  fiatDisbursed: boolean;
  rawStatus?: string;
  updatedAt: Date;
}

export interface CancelPayoutResult {
  providerPayoutId: string;
  status: 'CANCELLED' | 'CANNOT_CANCEL';
  reason?: string;
}

export interface ParsedOffRampWebhookEvent {
  providerPayoutId: string;
  merchantPayoutId?: string;
  eventType: string;
  status: OffRampOrderStatus;
  amount?: string;
  currency?: string;
  timestamp: Date;
  rawEvent: unknown;
}

export interface OffRampProviderAuditVerification {
  provider: string;
  apiAccess: boolean;
  sandboxAvailable: boolean;
  midnightSupport: boolean;
  previewSupport?: boolean;
  preprodSupport: boolean;
  supportedFiat: string[];
  supportedAssets: string[];
  supportedCountries: string[];
  supportedPayoutMethods: string[];
  webhookSupport: boolean;
  isBlocked: boolean;
  blockedReason: string;
}

export interface OffRampProvider {
  readonly providerName: string;
  readonly isBlocked: boolean;
  readonly blockedReason: string;

  /**
   * Returns verification audit results detailing API, sandbox, and Midnight compatibility.
   */
  getAuditVerification(): OffRampProviderAuditVerification;

  /**
   * Create an off-ramp payout with the provider.
   */
  createPayout(params: CreatePayoutParams): Promise<OffRampPayoutResult>;

  /**
   * Fetch latest payout status from the provider authoritatively.
   */
  getPayoutStatus(payoutId: string): Promise<PayoutStatusResult>;

  /**
   * Cancel an in-flight payout if permitted by rail state.
   */
  cancelPayout(payoutId: string): Promise<CancelPayoutResult>;

  /**
   * Verify signature / authenticity of an incoming payout webhook.
   */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawPayload: string | Buffer): boolean;

  /**
   * Parse verified webhook payload into normalized event.
   */
  parseWebhook(payload: unknown): ParsedOffRampWebhookEvent;

  /**
   * List supported fiat disbursement currencies (ISO 4217).
   */
  getSupportedFiatCurrencies(): string[];

  /**
   * List supported destination countries (ISO 3166-1 alpha-2).
   */
  getSupportedCountries(): string[];

  /**
   * List supported payout rail types (e.g. CASH_PICKUP, PUSH_TO_CARD, BANK_ACCOUNT).
   */
  getSupportedPayoutMethods(): string[];

  /**
   * List supported crypto assets (e.g. tDUST, USDC).
   */
  getSupportedAssets(): string[];
}
