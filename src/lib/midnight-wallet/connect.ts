/**
 * Unified Connect Engine for 1AM Midnight Wallet
 */

import { MidnightWalletProviderId, MidnightWalletSession } from './types'
import { MIDNIGHT_NETWORK } from './config'
import { oneamAdapter } from './oneam'

export async function connectWallet(
  _provider: MidnightWalletProviderId = '1am'
): Promise<MidnightWalletSession> {
  const targetNetworkId = MIDNIGHT_NETWORK.id
  return oneamAdapter.connect(targetNetworkId)
}

