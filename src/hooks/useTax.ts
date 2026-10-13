import type { Address } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { higherAbi, twapOracleAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { bpsToPct } from '../lib/melt'
import { DEMO, demo } from '../config/demo'

/**
 * The tax for a specific trade size, resolved in the same order as
 * `Higher._taxBps` — not by asking the oracle and hoping it matches.
 *
 *   1. inLaunchWindow() -> flat 800 bps, both directions, oracle not consulted
 *   2. otherwise TwapOracle.taxBps(amount, isSell), capped at 800 bps
 *   3. oracle missing or reverting -> 400 bps
 *
 * Mirroring the contract matters more than it looks: quoting a number the
 * token won't actually charge is exactly the failure the pre-trade disclosure
 * exists to prevent, and a naive read fails in the direction that flatters us.
 */
export const TAX_CAP_BPS = 800
export const TAX_FALLBACK_BPS = 400

const clamp = (bps: number) => Math.min(bps, TAX_CAP_BPS)

export function useTradeTax(amount: bigint | undefined) {
  const hasOracle = configured('twapOracle')
  const hasHigher = configured('higher')
  const live = amount !== undefined && amount > 0n && !DEMO

  const { data: launch } = useReadContract({
    address: addresses.higher as Address,
    abi: higherAbi,
    functionName: 'inLaunchWindow',
    query: { enabled: hasHigher && !DEMO, refetchInterval: 15_000 },
  })

  const inLaunchWindow = launch === undefined ? undefined : (launch as boolean)
  // In the launch window the token bypasses the oracle, so neither do we.
  const askOracle = live && hasOracle && inLaunchWindow === false

  const base = { address: addresses.twapOracle as Address, abi: twapOracleAbi } as const

  const { data, isFetching } = useReadContracts({
    contracts: [
      { ...base, functionName: 'taxBps', args: [amount ?? 0n, false] },
      { ...base, functionName: 'taxBps', args: [amount ?? 0n, true] },
    ],
    query: { enabled: askOracle, refetchInterval: 5_000 },
  })

  if (DEMO) {
    return {
      buyBps: demo.buyTaxBps,
      sellBps: demo.sellTaxBps,
      buyPct: bpsToPct(demo.buyTaxBps),
      sellPct: bpsToPct(demo.sellTaxBps),
      inLaunchWindow: false,
      isFetching: false,
      cap: TAX_CAP_BPS,
      configured: true,
    }
  }

  let buyBps: number | undefined
  let sellBps: number | undefined

  if (inLaunchWindow === true) {
    buyBps = TAX_CAP_BPS
    sellBps = TAX_CAP_BPS
  } else if (live) {
    const read = (i: number) => {
      const r = data?.[i]
      if (r?.status === 'success') return clamp(Number(r.result))
      // A reverting or absent oracle is not "no tax" — fall back as the token
      // does. Still loading stays undefined so the UI can say so.
      if (r?.status === 'failure' || !hasOracle) return TAX_FALLBACK_BPS
      return undefined
    }
    buyBps = read(0)
    sellBps = read(1)
  }

  return {
    buyBps,
    sellBps,
    buyPct: buyBps === undefined ? undefined : bpsToPct(buyBps),
    sellPct: sellBps === undefined ? undefined : bpsToPct(sellBps),
    inLaunchWindow,
    isFetching,
    cap: TAX_CAP_BPS,
    configured: hasOracle,
  }
}
