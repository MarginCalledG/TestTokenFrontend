import { useEffect, useRef } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { higherAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { projectBalance, rayToPct } from '../lib/melt'
import { useChainClock } from './useChainClock'
import { DEMO, DEMO_DECIMALS, demo } from '../config/demo'

const REFETCH_MS = 6_000

export function useHigherStats() {
  const enabled = configured('higher') && !DEMO
  const base = { address: addresses.higher as Address, abi: higherAbi } as const

  const { data, isLoading } = useReadContracts({
    contracts: [
      { ...base, functionName: 'ratePerDayBps' },
      { ...base, functionName: 'instantFreeFloatRay' },
      { ...base, functionName: 'totalSupply' },
      { ...base, functionName: 'decimals' },
      { ...base, functionName: 'perSecFactor' },
      { ...base, functionName: 'inLaunchWindow' },
      { ...base, functionName: 'maxWallet' },
      { ...base, functionName: 'mintRenounced' },
      { ...base, functionName: 'exemptControlRenounced' },
    ],
    query: { enabled, refetchInterval: REFETCH_MS },
  })

  const rateBps = data?.[0].status === 'success' ? Number(data[0].result) : undefined
  const freeFloatRay = data?.[1].status === 'success' ? data[1].result : undefined
  const totalSupply = data?.[2].status === 'success' ? data[2].result : undefined
  const decimals = data?.[3].status === 'success' ? Number(data[3].result) : 18
  const perSecFactor = data?.[4]?.status === 'success' ? (data[4].result as bigint) : undefined
  const inLaunchWindow = data?.[5]?.status === 'success' ? (data[5].result as boolean) : undefined
  const maxWallet = data?.[6]?.status === 'success' ? (data[6].result as bigint) : undefined
  /**
   * Whether the owner has permanently given up the ability to mint.
   * `undefined` means we haven't read it yet — which is NOT the same as false
   * and must not be rendered as reassurance.
   */
  const mintRenounced =
    data?.[7]?.status === 'success' ? (data[7].result as boolean) : undefined
  /**
   * Whether the owner can still exempt addresses from tax and the wallet cap.
   * Un-renounced, an address can be given terms nobody else gets — which is a
   * separate lever from minting and deserves its own line.
   */
  const exemptControlRenounced =
    data?.[8]?.status === 'success' ? (data[8].result as boolean) : undefined

  if (DEMO) {
    return {
      configured: true,
      isLoading: false,
      rateBps: demo.rateBps,
      freeFloatPct: rayToPct(demo.freeFloatRay),
      totalSupply: demo.totalSupply,
      decimals: DEMO_DECIMALS,
      perSecFactor: undefined,
      inLaunchWindow: false,
      maxWallet: undefined,
      mintRenounced: false,
      exemptControlRenounced: false,
    }
  }

  return {
    configured: enabled,
    isLoading,
    rateBps,
    freeFloatPct: freeFloatRay === undefined ? undefined : rayToPct(freeFloatRay),
    totalSupply,
    decimals,
    perSecFactor,
    inLaunchWindow,
    maxWallet,
    mintRenounced,
    exemptControlRenounced,
  }
}

/**
 * The headline number. Returns BOTH:
 *   - `onChain`: the exact bigint from the last read. Use this for anything
 *     that becomes a transaction argument.
 *   - `live`: a float projected forward to the current chain second. Display
 *     only. See lib/melt.ts for why this is honest rather than invented.
 */
export function useMeltingBalance(account?: Address) {
  const { address: connected } = useAccount()
  const owner = account ?? connected
  const enabled = configured('higher') && !!owner && !DEMO
  const { rateBps, decimals, perSecFactor } = useHigherStats()
  const { nowSec } = useChainClock()

  const { data: onChain, refetch } = useReadContract({
    address: addresses.higher as Address,
    abi: higherAbi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled, refetchInterval: REFETCH_MS },
  })

  /**
   * Anchor the projection to the chain second at which we received the read.
   * The read reflects the chain head at that moment, so this lags by at most
   * one block time — bounded, and small next to the quantities on screen.
   */
  const anchor = useRef<{ value: bigint; atSec: number } | null>(null)
  useEffect(() => {
    if (onChain === undefined) return
    anchor.current = { value: onChain, atSec: nowSec }
    // nowSec intentionally omitted: re-anchoring every tick would freeze the
    // display at the last read instead of decaying from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChain])

  if (DEMO) {
    return {
      onChain: demo.balance,
      live: projectBalance(
        demo.balance,
        DEMO_DECIMALS,
        nowSec - demo.balanceAnchorSec,
        demo.rateBps,
      ),
      decimals: DEMO_DECIMALS,
      rateBps: demo.rateBps,
      refetch,
      configured: true,
    }
  }

  const live =
    anchor.current && rateBps !== undefined
      ? projectBalance(
          anchor.current.value,
          decimals,
          nowSec - anchor.current.atSec,
          rateBps,
          perSecFactor,
        )
      : undefined

  return { onChain, live, decimals, rateBps, refetch, configured: enabled }
}
