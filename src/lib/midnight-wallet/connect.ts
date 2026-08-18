/**
 * Unified Connect Engine for Midnight Wallets
 */

import { MidnightWalletProviderId, MidnightWalletSession } from './types'
import { MidnightWalletError } from './errors'
import { MIDNIGHT_NETWORK } from './config'
import { laceAdapter } from './lace'
import { oneamAdapter } from './oneam'

export async function connectWallet(
  provider: MidnightWalletProviderId
): Promise<MidnightWalletSession> {
  const targetNetworkId = MIDNIGHT_NETWORK.id

  if (provider === 'lace') {
    return laceAdapter.connect(targetNetworkId)
  }

  if (provider === '1am') {
    return oneamAdapter.connect(targetNetworkId)
  }

  throw new MidnightWalletError(
    'WALLET_NOT_SUPPORTED',
    `Unsupported wallet provider: '${provider}'`
  )
}
