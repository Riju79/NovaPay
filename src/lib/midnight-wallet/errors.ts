/**
 * Midnight Wallet Custom Error Classes & Error Codes
 */

export type MidnightWalletErrorCode =
  | 'WALLET_NOT_INSTALLED'
  | 'WALLET_LOCKED'
  | 'CONNECTION_REJECTED'
  | 'CONNECTION_TIMEOUT'
  | 'ADDRESS_UNAVAILABLE'
  | 'WRONG_NETWORK'
  | 'WALLET_NOT_SUPPORTED'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN_ERROR'

const ERROR_MESSAGES: Record<MidnightWalletErrorCode, string> = {
  WALLET_NOT_INSTALLED: 'Wallet extension is not installed in your browser. Please install it and try again.',
  WALLET_LOCKED: 'Wallet is currently locked or uninitialized. Please unlock your wallet extension.',
  CONNECTION_REJECTED: 'Connection request was rejected in the wallet extension.',
  CONNECTION_TIMEOUT: 'Wallet connection timed out. Please open your wallet extension and approve the request.',
  ADDRESS_UNAVAILABLE: 'Could not retrieve a valid Midnight address from the connected wallet.',
  WRONG_NETWORK: 'Connected wallet is on an incompatible network. Please switch to the required Midnight network.',
  WALLET_NOT_SUPPORTED: 'This wallet environment is not supported on this browser or platform.',
  PROVIDER_ERROR: 'An error occurred within the wallet extension provider.',
  UNKNOWN_ERROR: 'An unexpected wallet error occurred. Please try again.',
}

export class MidnightWalletError extends Error {
  public readonly code: MidnightWalletErrorCode
  public readonly userMessage: string
  public readonly originalError?: unknown

  constructor(code: MidnightWalletErrorCode, customMessage?: string, originalError?: unknown) {
    const defaultMsg = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR
    const finalUserMsg = customMessage || defaultMsg
    super(`[MidnightWallet Error] ${code}: ${finalUserMsg}`)

    this.name = 'MidnightWalletError'
    this.code = code
    this.userMessage = finalUserMsg
    this.originalError = originalError

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, MidnightWalletError.prototype)
  }
}
