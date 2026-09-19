/**
 * Phase 10 — On-Ramp Provider Interface
 *
 * Defines the contract for all fiat-to-crypto on-ramp providers.
 * Providers must strictly implement this interface.
 * If a provider lacks Midnight / tDUST settlement, it must declare isBlocked = true.
 */

export type OnRampOrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'CONVERSION_PENDING'
  | 'ASSET_READY'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface CreateOrderParams {
  userId: string;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAsset?: string;
  cryptoAmount?: string;
  destinationWallet: string;
  paymentMethod: string;
  idempotencyKey?: string;
  redirectUrl?: string;
}

export interface OnRampOrderResult {
  orderId: string;
  providerOrderId: string;
  status: OnRampOrderStatus;
  paymentUrl?: string;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount: string;
  cryptoAsset: string;
  destinationWallet: string;
  instructions?: Record<string, unknown>;
  createdAt: Date;
}

export interface OrderStatusResult {
  providerOrderId: string;
  status: OnRampOrderStatus;
  fiatReceived: boolean;
  rawStatus?: string;
  updatedAt: Date;
}

export interface CancelOrderResult {
  providerOrderId: string;
  status: 'CANCELLED' | 'CANNOT_CANCEL';
  reason?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

export interface ParsedWebhookEvent {
  providerOrderId: string;
  merchantOrderId?: string;
  eventType: string;
  status: OnRampOrderStatus;
  amount?: string;
  currency?: string;
  timestamp: Date;
  rawEvent: unknown;
}

export interface ProviderAuditVerification {
  provider: string;
  apiAccess: boolean;
  sandboxAvailable: boolean;
  midnightSupport: boolean;
  previewSupport?: boolean;
  preprodSupport: boolean;
  supportedFiat: string[];
  supportedAssets: string[];
  supportedCountries: string[];
  paymentMethods: string[];
  webhookSupport: boolean;
  isBlocked: boolean;
  blockedReason: string;
}

export interface OnRampProvider {
  readonly providerName: string;
  readonly isBlocked: boolean;
  readonly blockedReason: string;

  /**
   * Returns verification audit results detailing API, sandbox, and Midnight compatibility.
   */
  getAuditVerification(): ProviderAuditVerification;

  /**
   * Create an on-ramp order with the provider.
   */
  createOrder(params: CreateOrderParams): Promise<OnRampOrderResult>;

  /**
   * Fetch latest status from the provider authoritatively.
   */
  getOrderStatus(orderId: string): Promise<OrderStatusResult>;

  /**
   * Cancel an in-flight order if supported by the provider.
   */
  cancelOrder(orderId: string): Promise<CancelOrderResult>;

  /**
   * Verify signature / authenticity of an incoming webhook.
   */
  verifyWebhook(headers: Record<string, string | string[] | undefined>, rawPayload: string | Buffer): boolean;

  /**
   * Parse verified webhook payload into normalized event.
   */
  parseWebhook(payload: unknown): ParsedWebhookEvent;

  /**
   * List supported fiat currencies (ISO 4217).
   */
  getSupportedFiatCurrencies(): string[];

  /**
   * List supported crypto assets (e.g. tDUST, USDC).
   */
  getSupportedAssets(): string[];

  /**
   * List supported country codes (ISO 3166-1 alpha-2).
   */
  getSupportedCountries(): string[];

  /**
   * List supported payment rail types (e.g. CARD, CASH_AGENT, BANK_TRANSFER).
   */
  getSupportedPaymentMethods(): string[];
}
