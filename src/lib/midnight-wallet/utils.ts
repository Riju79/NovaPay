import { UnknownProvider } from './types'

export interface ExtractedAddresses {
  address: string
  shieldedAddress?: string
  unshieldedAddress?: string
  networkId?: string
}

/**
 * Safely resolves Promises, RxJS Observables, BehaviorSubjects, Functions, or Objects
 */
async function resolveValueOrObservable(input: unknown, timeoutMs = 2500): Promise<unknown> {
  if (!input) return input

  // If input is a Promise
  if (typeof (input as Promise<unknown>).then === 'function') {
    try {
      const resolved = await input
      return resolveValueOrObservable(resolved, timeoutMs)
    } catch (err) {
      console.warn('[MidnightWallet DEBUG] Error resolving Promise:', err)
      return null
    }
  }

  const obj = input as any

  // If input is a BehaviorSubject / Subject with getValue() or value property
  if (typeof obj.getValue === 'function') {
    try {
      const val = obj.getValue()
      if (val !== undefined && val !== null) return val
    } catch {
      // ignore
    }
  }

  if (obj.value !== undefined && obj.value !== null && typeof obj.value === 'object') {
    return obj.value
  }

  // If input is an RxJS Observable (has .subscribe function)
  if (typeof obj.subscribe === 'function') {
    return new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          console.warn('[MidnightWallet DEBUG] Observable subscribe timed out after', timeoutMs, 'ms')
          resolve(null)
        }
      }, timeoutMs)

      try {
        const sub = obj.subscribe({
          next: (val: unknown) => {
            if (!settled && val !== undefined && val !== null) {
              settled = true
              clearTimeout(timer)
              console.log('[MidnightWallet DEBUG] Observable emitted value:', val)
              if (sub && typeof sub.unsubscribe === 'function') {
                try {
                  sub.unsubscribe()
                } catch {
                  // ignore
                }
              }
              resolve(val)
            }
          },
          error: (err: unknown) => {
            if (!settled) {
              settled = true
              clearTimeout(timer)
              console.warn('[MidnightWallet DEBUG] Observable emitted error:', err)
              resolve(null)
            }
          },
        })
      } catch (err) {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          console.warn('[MidnightWallet DEBUG] Error subscribing to Observable:', err)
          resolve(null)
        }
      }
    })
  }

  return input
}

/**
 * Deep, resilient extractor for Midnight wallet addresses
 */
export async function extractMidnightAddresses(
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<ExtractedAddresses> {
  console.log('[MidnightWallet DEBUG] Starting address extraction')
  console.log('[MidnightWallet DEBUG] enabledApi:', enabledApi)
  console.log('[MidnightWallet DEBUG] rawProvider:', rawProvider)

  const isValidStr = (v: unknown): v is string =>
    typeof v === 'string' && v.trim().length > 0 && !v.includes('http://') && !v.includes('https://')

  // 1. Direct string response check
  if (isValidStr(enabledApi)) {
    console.log('[MidnightWallet DEBUG] Direct string enabledApi address found:', enabledApi)
    return { address: enabledApi.trim() }
  }

  // 2. Direct string array check
  if (Array.isArray(enabledApi) && enabledApi.length > 0 && isValidStr(enabledApi[0])) {
    console.log('[MidnightWallet DEBUG] Array enabledApi address found:', enabledApi[0])
    return { address: enabledApi[0].trim() }
  }

  const candidates: UnknownProvider[] = []

  if (enabledApi && (typeof enabledApi === 'object' || typeof enabledApi === 'function')) {
    candidates.push(enabledApi as UnknownProvider)
  }
  if (rawProvider && (typeof rawProvider === 'object' || typeof rawProvider === 'function')) {
    candidates.push(rawProvider)
  }

  const searchPool: UnknownProvider[] = []

  // 3. Method execution and state resolution across candidates
  const methodNamesToTry = [
    'state',
    'getState',
    'fetchState',
    'status',
    'getAccounts',
    'accounts',
    'getAddress',
    'addresses',
    'getAddresses',
    'getShieldedAddress',
    'shieldedAddress',
    'getUnshieldedAddress',
    'unshieldedAddress',
    'getCoinPublicKey',
    'coinPublicKey',
    'getPublicKey',
    'publicKey',
    'getUsedAddresses',
    'getUnusedAddresses',
    'getChangeAddress',
  ]

  for (const obj of candidates) {
    if (!obj) continue
    searchPool.push(obj)

    // Inspect own and prototype properties
    const keys = new Set<string>([
      ...Object.keys(obj),
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(obj) || {}),
    ])

    console.log('[MidnightWallet DEBUG] Candidate object keys:', Array.from(keys))

    for (const methodName of methodNamesToTry) {
      if (typeof (obj as any)[methodName] === 'function') {
        try {
          console.log(`[MidnightWallet DEBUG] Invoking method ${methodName}()`)
          const rawRes = (obj as any)[methodName]()
          const resolved = await resolveValueOrObservable(rawRes)
          if (resolved) {
            console.log(`[MidnightWallet DEBUG] Method ${methodName}() resolved to:`, resolved)
            if (typeof resolved === 'object' || typeof resolved === 'function') {
              searchPool.push(resolved as UnknownProvider)
            } else if (isValidStr(resolved)) {
              searchPool.push({ [methodName]: resolved } as UnknownProvider)
            }
          }
        } catch (err) {
          console.warn(`[MidnightWallet DEBUG] Error invoking ${methodName}():`, err)
        }
      }
    }
  }

  let shieldedAddress: string | undefined
  let unshieldedAddress: string | undefined
  let primaryAddress: string | undefined
  let extractedNetworkId: string | undefined

  const isContractAddress = (val: string): boolean => {
    const l = val.toLowerCase()
    return l.includes('contract') || l.includes('escrow') || l.includes('recurring')
  }

  // Recursive deep property scanner
  const visited = new Set<unknown>()
  const scanForAddresses = (target: unknown, depth = 0) => {
    if (!target || depth > 5 || visited.has(target)) return
    if (typeof target !== 'object' && typeof target !== 'function') return

    visited.add(target)
    const obj = target as Record<string, unknown>

    let entries: [string, unknown][] = []
    try {
      entries = Object.entries(obj)
    } catch {
      return
    }

    for (const [key, val] of entries) {
      if (!val) continue
      const lowerKey = key.toLowerCase()

      if (isValidStr(val)) {
        const strVal = val.trim()
        const lowerVal = strVal.toLowerCase()

        if (isContractAddress(strVal)) {
          continue
        }

        const isMidnightAddressFormat =
          lowerVal.startsWith('mn_') ||
          lowerVal.startsWith('mn1') ||
          lowerVal.startsWith('addr_') ||
          lowerVal.startsWith('addr1')

        if ((lowerKey.includes('shielded') || lowerVal.includes('shielded')) && !shieldedAddress) {
          console.log(`[MidnightWallet DEBUG] Found shielded address under key '${key}':`, strVal)
          shieldedAddress = strVal
        } else if ((lowerKey.includes('unshielded') || lowerVal.includes('unshielded')) && !unshieldedAddress) {
          console.log(`[MidnightWallet DEBUG] Found unshielded address under key '${key}':`, strVal)
          unshieldedAddress = strVal
        } else if (
          (isMidnightAddressFormat ||
            lowerKey === 'address' ||
            lowerKey.includes('bech32') ||
            lowerKey.includes('coinpublickey') ||
            lowerKey.includes('publickey') ||
            lowerKey.includes('account') ||
            lowerKey.includes('addr')) &&
          !primaryAddress
        ) {
          console.log(`[MidnightWallet DEBUG] Found primary address under key '${key}':`, strVal)
          primaryAddress = strVal
        }
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (isValidStr(item) && !isContractAddress(item) && !primaryAddress) {
            console.log(`[MidnightWallet DEBUG] Found address in array '${key}':`, item)
            primaryAddress = item.trim()
          } else if (typeof item === 'object') {
            scanForAddresses(item, depth + 1)
          }
        }
      } else if (typeof val === 'object' && depth < 5) {
        scanForAddresses(val, depth + 1)
      }
    }
  }

  for (const item of searchPool) {
    if (!item) continue

    if (!shieldedAddress && isValidStr(item.shieldedAddress) && !isContractAddress(item.shieldedAddress)) {
      shieldedAddress = item.shieldedAddress.trim()
    }
    if (!unshieldedAddress && isValidStr(item.unshieldedAddress) && !isContractAddress(item.unshieldedAddress)) {
      unshieldedAddress = item.unshieldedAddress.trim()
    }
    if (!primaryAddress && isValidStr(item.address) && !isContractAddress(item.address)) {
      primaryAddress = item.address.trim()
    }
    if (!primaryAddress && isValidStr(item.coinPublicKey) && !isContractAddress(item.coinPublicKey)) {
      primaryAddress = item.coinPublicKey.trim()
    }
    if (!primaryAddress && isValidStr(item.publicKey) && !isContractAddress(item.publicKey)) {
      primaryAddress = item.publicKey.trim()
    }

    if (!extractedNetworkId) {
      if (isValidStr(item.networkId) || typeof item.networkId === 'number') {
        extractedNetworkId = String(item.networkId)
      } else if (item.network && typeof item.network === 'object') {
        const netObj = item.network as UnknownProvider
        if (isValidStr(netObj.id) || isValidStr(netObj.name)) {
          extractedNetworkId = String(netObj.id || netObj.name)
        }
      }
    }

    // Run deep object scanner on this candidate
    scanForAddresses(item)
  }

  // Resolve final primary address preference: shielded > unshielded > primary
  const finalAddress = shieldedAddress || unshieldedAddress || primaryAddress

  // Auto-infer networkId from Midnight address Bech32 prefix if not explicitly set
  if (!extractedNetworkId && finalAddress) {
    const lower = finalAddress.toLowerCase()
    if (lower.includes('preprod')) {
      extractedNetworkId = 'preprod'
    } else if (lower.includes('preview')) {
      extractedNetworkId = 'preview'
    } else if (lower.includes('devnet')) {
      extractedNetworkId = 'devnet'
    } else if (lower.includes('mainnet')) {
      extractedNetworkId = 'mainnet'
    }
  }

  console.log('[MidnightWallet DEBUG] Final address extraction result:', {
    address: finalAddress,
    shieldedAddress,
    unshieldedAddress,
    networkId: extractedNetworkId,
  })

  return {
    address: finalAddress || '',
    shieldedAddress,
    unshieldedAddress,
    networkId: extractedNetworkId,
  }
}

/**
 * Helper to parse balance structures from Maps, Arrays, Objects, or RxJS emissions
 */
function parseBalancesFromAny(target: unknown, depth = 0): { unshieldedTDust: string; shieldedTDust: string; tDust: string; usdc: string } | null {
  if (!target || depth > 4) return null

  let unshieldedTotal = 0
  let shieldedTotal = 0
  let usdcTotal = 0
  let foundAny = false

  const normalizeAmount = (valStr: string): number => {
    const num = parseFloat(valStr)
    if (isNaN(num) || num <= 0) return 0
    const trimmed = valStr.trim()
    const isPureInt = /^\d+$/.test(trimmed)
    // 1AM DUST uses 3 decimals (1 DUST = 1,000 micro-units). If atomic integer >= 100,000, divide by 1,000.
    if (isPureInt && num >= 100000) {
      return num / 1000
    }
    return num
  }

  const addVal = (assetKey: string, val: unknown, isShieldedContext = false) => {
    let numStr = '0'
    if (typeof val === 'number' || typeof val === 'bigint' || typeof val === 'string') {
      numStr = String(val)
    } else if (val && typeof val === 'object') {
      const vObj = val as any
      if (vObj.value !== undefined) numStr = String(vObj.value)
      else if (vObj.amount !== undefined) numStr = String(vObj.amount)
      else if (vObj.quantity !== undefined) numStr = String(vObj.quantity)
    }

    const num = normalizeAmount(numStr)
    if (num > 0) {
      const lowerKey = String(assetKey).toLowerCase()
      const isShieldedKey = isShieldedContext || lowerKey.includes('shielded') || lowerKey.includes('private')

      if (lowerKey.includes('usdc') || lowerKey.includes('dollar') || lowerKey.includes('stable')) {
        usdcTotal += num
        foundAny = true
      } else if (isShieldedKey) {
        shieldedTotal += num
        foundAny = true
      } else {
        unshieldedTotal += num
        foundAny = true
      }
    }
  }

  // 1. Map instance
  if (target instanceof Map) {
    for (const [k, v] of target.entries()) {
      addVal(String(k), v)
    }
  }
  // 2. Array instance (UTXOs / Coins)
  else if (Array.isArray(target)) {
    for (const item of target) {
      if (item && typeof item === 'object') {
        const itemObj = item as any
        const assetName = itemObj.symbol || itemObj.token || itemObj.asset || itemObj.type || itemObj.id || 'tDUST'
        const val = itemObj.value ?? itemObj.amount ?? itemObj.quantity ?? item
        const isShieldedItem = Boolean(itemObj.isShielded || itemObj.shielded || String(assetName).toLowerCase().includes('shielded'))
        addVal(String(assetName), val, isShieldedItem)
      } else {
        addVal('tDUST', item)
      }
    }
  }
  // 3. Object instance
  else if (typeof target === 'object') {
    const obj = target as Record<string, unknown>

    // Check explicit 1AM holdings properties on state object (as seen in 1AM extension UI)
    const rawUnshieldedProp =
      obj.unshieldedBalance ??
      obj.unshieldedHoldings ??
      obj.unshieldedCoins ??
      obj.unshielded ??
      obj.nightBalance ??
      obj.dustBalance ??
      obj.unshieldedNight

    const rawShieldedProp =
      obj.shieldedHoldings ??
      obj.shieldedBalance ??
      obj.shieldedCoins ??
      obj.shielded ??
      obj.shieldedNight

    if (rawUnshieldedProp !== undefined || rawShieldedProp !== undefined) {
      if (rawUnshieldedProp !== undefined && rawUnshieldedProp !== null) {
        const uParsed = normalizeAmount(String(rawUnshieldedProp))
        if (uParsed > 0) {
          unshieldedTotal += uParsed
          foundAny = true
        } else {
          const uRes = parseBalancesFromAny(rawUnshieldedProp, depth + 1)
          if (uRes) {
            unshieldedTotal += parseFloat(uRes.unshieldedTDust.replace(/,/g, '')) || 0
            foundAny = true
          }
        }
      }

      if (rawShieldedProp !== undefined && rawShieldedProp !== null) {
        const sParsed = normalizeAmount(String(rawShieldedProp))
        if (sParsed >= 0) {
          shieldedTotal += sParsed
          foundAny = true
        } else {
          const sRes = parseBalancesFromAny(rawShieldedProp, depth + 1)
          if (sRes) {
            shieldedTotal += parseFloat(sRes.shieldedTDust.replace(/,/g, '') || sRes.unshieldedTDust.replace(/,/g, '')) || 0
            foundAny = true
          }
        }
      }
    } else {
      const subPool = [obj.balances, obj.coins, obj.utxos, obj.assets, obj.state]
      for (const sub of subPool) {
        if (sub && sub !== target) {
          const subRes = parseBalancesFromAny(sub, depth + 1)
          if (subRes) {
            unshieldedTotal += parseFloat(subRes.unshieldedTDust.replace(/,/g, '')) || 0
            shieldedTotal += parseFloat(subRes.shieldedTDust.replace(/,/g, '')) || 0
            usdcTotal += parseFloat(subRes.usdc.replace(/,/g, '')) || 0
            foundAny = true
          }
        }
      }

      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) continue
        if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'string') {
          addVal(k, v)
        } else if (typeof v === 'object') {
          const subRes = parseBalancesFromAny(v, depth + 1)
          if (subRes) {
            unshieldedTotal += parseFloat(subRes.unshieldedTDust.replace(/,/g, '')) || 0
            shieldedTotal += parseFloat(subRes.shieldedTDust.replace(/,/g, '')) || 0
            usdcTotal += parseFloat(subRes.usdc.replace(/,/g, '')) || 0
            foundAny = true
          }
        }
      }
    }
  }

  if (foundAny) {
    const uStr = unshieldedTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })
    const sStr = shieldedTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })
    const totalStr = (unshieldedTotal + shieldedTotal).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 })
    return {
      unshieldedTDust: uStr,
      shieldedTDust: sStr,
      tDust: totalStr,
      usdc: usdcTotal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 }),
    }
  }

  return null
}

/**
 * Extract live balances directly from 1AM Midnight wallet extension
 */
export async function extractMidnightBalances(
  enabledApi: unknown,
  rawProvider: UnknownProvider
): Promise<{ unshieldedTDust: string; shieldedTDust: string; tDust: string; usdc: string } | null> {
  const candidates: any[] = []

  if (enabledApi) candidates.push(enabledApi)
  if (rawProvider && rawProvider !== enabledApi) candidates.push(rawProvider)

  for (const obj of candidates) {
    if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) continue

    // 1. Direct 1AM property/method inspector for exact 1AM fields: unshieldedBalance / unshieldedHoldings, shieldedHoldings / shieldedBalance
    try {
      const resolveProp = async (propVal: unknown) => {
        if (typeof propVal === 'function') {
          try {
            return await resolveValueOrObservable(propVal())
          } catch {
            return undefined
          }
        }
        return await resolveValueOrObservable(propVal)
      }

      const rawU = await resolveProp(
        (obj as any).getUnshieldedBalance ??
        (obj as any).unshieldedBalance ??
        (obj as any).unshieldedHoldings ??
        (obj as any).unshielded ??
        (obj as any).getNightBalance ??
        (obj as any).nightBalance ??
        (obj as any).getDustBalance ??
        (obj as any).dustBalance
      )
      const rawS = await resolveProp(
        (obj as any).getShieldedBalance ??
        (obj as any).shieldedHoldings ??
        (obj as any).shieldedBalance ??
        (obj as any).shielded ??
        (obj as any).getShieldedHoldings
      )

      let uVal: number | null = null
      let sVal: number | null = null

      if (rawU !== undefined && rawU !== null) {
        const numUStr = String(rawU).trim()
        const parsedU = parseFloat(numUStr)
        if (!isNaN(parsedU)) {
          const isPureInt = /^\d+$/.test(numUStr)
          uVal = (isPureInt && parsedU >= 100000) ? parsedU / 1000 : parsedU
        }
      }

      if (rawS !== undefined && rawS !== null) {
        const numSStr = String(rawS).trim()
        const parsedS = parseFloat(numSStr)
        if (!isNaN(parsedS)) {
          const isPureInt = /^\d+$/.test(numSStr)
          sVal = (isPureInt && parsedS >= 100000) ? parsedS / 1000 : parsedS
        }
      }

      if (uVal !== null || sVal !== null) {
        const finalU = uVal || 0
        const finalS = sVal || 0
        console.log('[MidnightWallet] Direct 1AM extension holdings extracted:', { unshielded: finalU, shielded: finalS })
        return {
          unshieldedTDust: finalU.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 }),
          shieldedTDust: finalS.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 }),
          tDust: (finalU + finalS).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 4 }),
          usdc: '0.00',
        }
      }
    } catch (err) {
      console.warn('[MidnightWallet] Direct 1AM holdings scan error:', err)
    }

    // 2. Standard method execution scanner
    const balanceMethods = [
      'state',
      'getState',
      'fetchState',
      'status',
      'getBalance',
      'getBalances',
      'balance',
      'balances',
      'getUnshieldedBalance',
      'unshieldedBalance',
      'getShieldedBalance',
      'shieldedBalance',
      'getNightBalance',
      'nightBalance',
      'getCoins',
      'coins',
      'getShieldedCoins',
      'getUnshieldedCoins',
      'getUtxos',
      'utxos',
    ]

    for (const method of balanceMethods) {
      if (typeof obj[method] === 'function') {
        try {
          const rawRes = obj[method]()
          const resolved = await resolveValueOrObservable(rawRes)
          if (resolved) {
            const parsed = parseBalancesFromAny(resolved)
            if (parsed) return parsed
          }
        } catch (err) {
          console.warn(`[MidnightWallet DEBUG] Balance extraction error via ${method}():`, err)
        }
      }
    }

    const directParsed = parseBalancesFromAny(obj)
    if (directParsed) return directParsed
  }

  return null
}

/**
 * Compare target network against wallet network flexibly
 */
export function isNetworkCompatible(targetNetworkId: string, walletNetworkId?: string): boolean {
  if (!targetNetworkId || !walletNetworkId) return true

  const target = targetNetworkId.toLowerCase().trim()
  const wallet = walletNetworkId.toLowerCase().trim()

  if (target === wallet) return true
  if (wallet.includes(target) || target.includes(wallet)) return true

  // Standard aliases (e.g. preview vs previewnet)
  if ((target === 'preview' || target === 'previewnet') && (wallet === 'preview' || wallet === 'previewnet')) {
    return true
  }
  if ((target === 'preprod' || target === 'preprodnet') && (wallet === 'preprod' || wallet === 'preprodnet')) {
    return true
  }

  return false
}


