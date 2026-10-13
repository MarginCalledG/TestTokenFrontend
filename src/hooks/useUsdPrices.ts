import type { Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { v2PairAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import { DEMO } from '../config/demo'

export type UsdPrices = {
  /** USD per whole token, from Uniswap v2 spot reserves. Undefined while loading. */
  spy?: number
  eth?: number
  higher?: number
}

/** USDG has 6 decimals; everything else on the route has 18. */
function dec(token: Address | undefined): number {
  return token && addresses.usdg && token.toLowerCase() === addresses.usdg.toLowerCase() ? 6 : 18
}

/**
 * Spot prices in USD, read from pool reserves (no fee, no price impact):
 *   SPY    = SPY/USDG pool
 *   ETH    = WETH/USDG pool
 *   HIGHER = HIGHER/SPY pool × SPY price
 * USDG is treated as $1. Good enough for "≈ $x" labels; the trade itself is quoted by the router.
 */
export function useUsdPrices(): UsdPrices {
  const ok = configured('pair', 'spyUsdgPair', 'wethUsdgPair', 'higher', 'spy', 'usdg') && !DEMO
  const pairs = [addresses.pair, addresses.spyUsdgPair, addresses.wethUsdgPair] as Address[]
  const { data } = useReadContracts({
    contracts: pairs.flatMap((p) => [
      { address: p, abi: v2PairAbi, functionName: 'token0' } as const,
      { address: p, abi: v2PairAbi, functionName: 'getReserves' } as const,
    ]),
    query: { enabled: ok, refetchInterval: 15_000 },
  })
  if (!data) return {}

  /** Price of `token` in units of the pool's other token. */
  const priceIn = (i: number, token: Address | null): number | undefined => {
    const t0 = data[2 * i]
    const r = data[2 * i + 1]
    if (!token || t0?.status !== 'success' || r?.status !== 'success') return undefined
    const token0 = t0.result as Address
    const [r0, r1] = r.result as readonly [bigint, bigint, number]
    const isT0 = token0.toLowerCase() === token.toLowerCase()
    const mine = isT0 ? r0 : r1
    const other = isT0 ? r1 : r0
    if (mine === 0n) return undefined
    const otherDec = i === 0 ? 18 : dec(addresses.usdg as Address) // HIGHER/SPY vs the two USDG pools
    return Number(other) / 10 ** otherDec / (Number(mine) / 1e18)
  }

  const spy = priceIn(1, addresses.spy)
  const eth = priceIn(2, addresses.weth)
  const higherInSpy = priceIn(0, addresses.higher)
  return { spy, eth, higher: higherInSpy !== undefined && spy !== undefined ? higherInSpy * spy : undefined }
}

/** "≈ $1,234.56" — or "≈ $0.0000123" for tiny values, so small trades still show something. */
export function usd(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return ''
  if (v !== 0 && Math.abs(v) < 0.01) return `≈ $${v.toPrecision(3)}`
  return `≈ $${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
