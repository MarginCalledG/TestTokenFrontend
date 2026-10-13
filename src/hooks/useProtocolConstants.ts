import type { Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { caymanAbi, erc20Abi, irsAgentAbi, higherAbi } from '../abi'
import { addresses, configured } from '../config/addresses'
import {
  AGENT_RANKS,
  EPOCH_SEC,
  FEED_INTERVAL_SEC,
  LOCK_TIERS,
  MAX_AGENTS_PER_WALLET,
  MINT_PRICE_USDG,
} from '../config/protocol'
import { DEMO } from '../config/demo'

/**
 * Reads the numbers the UI quotes at people — odds, weights, fees, feed costs,
 * caps — from the contracts rather than from a constants file.
 *
 * This exists because the alternative is worse than it looks. The screens make
 * specific claims ("30% audit success", "$99 to mint", "10 agents per wallet")
 * and those claims are the whole point of the honesty requirements. A constant
 * that drifts from the deployed value doesn't fail loudly — it renders a
 * confident, wrong number on a page whose job is to be trusted.
 *
 * So: chain values win, and when a chain value disagrees with the expected one
 * the mismatch is surfaced in the UI instead of being silently reconciled.
 */

/** Scale guess for HITRATE: stored as uint16, so 30 or 3000 both fit 30%. */
function hitratePct(raw: number): number {
  return raw > 100 ? raw / 100 : raw
}

export type Mismatch = { label: string; onChain: string; expected: string }

export function useProtocolConstants() {
  const hasAgent = configured('irsAgent')
  const hasCayman = configured('cayman')
  const hasHigher = configured('higher')
  const hasUsdg = configured('usdg')

  const agent = { address: addresses.irsAgent as Address, abi: irsAgentAbi } as const
  const cayman = { address: addresses.cayman as Address, abi: caymanAbi } as const
  const higher = { address: addresses.higher as Address, abi: higherAbi } as const

  // Split per contract: a single mixed useReadContracts call collapses the
  // functionName union across ABIs and loses type checking, which is the whole
  // reason for using the generated ABIs in the first place.
  const shared = { staleTime: Infinity, refetchInterval: false } as const

  // Argument-taking and no-argument reads also have to be separated: mixing
  // them in one array collapses functionName to the entries that take args.
  const { data: agentScalars } = useReadContracts({
    contracts: [
      { ...agent, functionName: 'MINT_PRICE' },
      { ...agent, functionName: 'MAX_PER_WALLET' },
      { ...agent, functionName: 'LIFE' },
      { ...agent, functionName: 'EPOCH' },
    ],
    query: { ...shared, enabled: hasAgent && !DEMO },
  })

  const { data: agentPerRank } = useReadContracts({
    contracts: ([0, 1, 2] as const).flatMap((i) => [
      { ...agent, functionName: 'HITRATE', args: [BigInt(i)] } as const,
      { ...agent, functionName: 'WEIGHT', args: [BigInt(i)] } as const,
      { ...agent, functionName: 'FEED', args: [BigInt(i)] } as const,
    ]),
    query: { ...shared, enabled: hasAgent && !DEMO },
  })

  const { data: caymanData } = useReadContracts({
    contracts: ([0, 1, 2] as const).flatMap((i) => [
      { ...cayman, functionName: 'FEE', args: [BigInt(i)] } as const,
      { ...cayman, functionName: 'DURATION', args: [BigInt(i)] } as const,
      // BLEED is gone. POS maps a tier to a position class, and the melt rate
      // for that class comes from Higher.ratePerDayBpsFor — the rate is no
      // longer one global number.
      { ...cayman, functionName: 'POS', args: [BigInt(i)] } as const,
    ]),
    query: { ...shared, enabled: hasCayman && !DEMO },
  })

  const { data: miscData } = useReadContracts({
    contracts: [
      { ...higher, functionName: 'LAUNCH_TAX_BPS' },
      { ...higher, functionName: 'MAX_WALLET_BPS' },
    ],
    query: { ...shared, enabled: hasHigher && !DEMO },
  })

  const { data: usdgDecimalsRaw } = useReadContracts({
    contracts: [
      { address: addresses.usdg as Address, abi: erc20Abi, functionName: 'decimals' },
    ],
    query: { ...shared, enabled: hasUsdg && !DEMO },
  })

  const pick = (d: readonly { status: string; result?: unknown }[] | undefined, i: number) =>
    d?.[i]?.status === 'success' ? d[i].result : undefined
  const big = (d: Parameters<typeof pick>[0], i: number) => {
    const v = pick(d, i)
    return typeof v === 'bigint' ? v : undefined
  }
  const nr = (d: Parameters<typeof pick>[0], i: number) => {
    const v = pick(d, i)
    return v === undefined ? undefined : Number(v)
  }

  /** USDG decimals, read rather than assumed — a wrong guess here is a 10^12 error. */
  const usdgDecimals = nr(usdgDecimalsRaw, 0) ?? 6

  const toUsdg = (v: bigint | undefined) =>
    v === undefined ? undefined : Number(v) / 10 ** usdgDecimals

  const mintPrice = toUsdg(big(agentScalars, 0))
  const maxPerWallet = nr(agentScalars, 1)
  const feedInterval = nr(agentScalars, 2)
  const epochSec = nr(agentScalars, 3)

  const ranks = ([0, 1, 2] as const).map((i) => {
    const b = i * 3
    const raw = nr(agentPerRank, b)
    return {
      id: i,
      hitRatePct: raw === undefined ? undefined : hitratePct(raw),
      weight: nr(agentPerRank, b + 1),
      feedUsdg: toUsdg(big(agentPerRank, b + 2)),
    }
  })


  /** Position class per tier, then the melt rate for each of those classes. */
  const tierPos = ([0, 1, 2] as const).map((i) => nr(caymanData, i * 3 + 2))

  const { data: rateData } = useReadContracts({
    contracts: tierPos.map(
      (pos) =>
        ({
          ...higher,
          functionName: 'ratePerDayBpsFor',
          args: [pos ?? 0],
        }) as const,
    ),
    query: {
      ...shared,
      enabled: hasHigher && !DEMO && tierPos.every((p) => p !== undefined),
    },
  })

  const tiers = ([0, 1, 2] as const).map((i) => {
    const b = i * 3
    return {
      id: i,
      feeUsdg: toUsdg(big(caymanData, b)),
      durationSec: nr(caymanData, b + 1),
      posClass: nr(caymanData, b + 2),
      bleedBps: nr(rateData, i),
    }
  })

  const launchTaxBps = nr(miscData, 0)
  const loaded = mintPrice !== undefined

  /**
   * Anything the contract says that contradicts what we ship. Surfaced, not
   * hidden — if these disagree, one of them is a lie and the user should know
   * which numbers came from where.
   */
  const mismatches: Mismatch[] = []
  if (loaded && !DEMO) {
    const cmp = (label: string, chain: unknown, expected: unknown) => {
      if (chain === undefined) return
      if (String(chain) !== String(expected)) {
        mismatches.push({
          label,
          onChain: String(chain),
          expected: String(expected),
        })
      }
    }
    cmp('Mint price (USDG)', mintPrice, MINT_PRICE_USDG)
    cmp('Max agents per wallet', maxPerWallet, MAX_AGENTS_PER_WALLET)
    cmp('Feed interval (s)', feedInterval, FEED_INTERVAL_SEC)
    cmp('Epoch length (s)', epochSec, EPOCH_SEC)
    ranks.forEach((r, i) => {
      cmp(`${AGENT_RANKS[i].name} hit rate (%)`, r.hitRatePct, AGENT_RANKS[i].hitRatePct)
      cmp(`${AGENT_RANKS[i].name} weight`, r.weight, AGENT_RANKS[i].weight)
      cmp(`${AGENT_RANKS[i].name} feed (USDG)`, r.feedUsdg, AGENT_RANKS[i].feedUsdg)
    })
    tiers.forEach((t, i) => {
      cmp(`${LOCK_TIERS[i].name} fee (USDG)`, t.feeUsdg, LOCK_TIERS[i].feeUsdg)
      cmp(`${LOCK_TIERS[i].name} duration (s)`, t.durationSec, LOCK_TIERS[i].durationSec)
    })
  }

  return {
    loaded,
    usdgDecimals,
    mintPrice,
    maxPerWallet,
    feedInterval,
    epochSec,
    ranks,
    tiers,
    launchTaxBps,
    mismatches,
  }
}

/**
 * Merges chain values over the shipped defaults for the agent ranks, so screens
 * can render one list without branching on whether the read landed.
 */
export function useRanks() {
  const c = useProtocolConstants()
  return AGENT_RANKS.map((r, i) => ({
    ...r,
    hitRatePct: c.ranks[i].hitRatePct ?? r.hitRatePct,
    weight: c.ranks[i].weight ?? r.weight,
    feedUsdg: c.ranks[i].feedUsdg ?? r.feedUsdg,
    fromChain: c.ranks[i].hitRatePct !== undefined,
  }))
}

export function useTiers() {
  const c = useProtocolConstants()
  return LOCK_TIERS.map((t, i) => ({
    ...t,
    feeUsdg: c.tiers[i].feeUsdg ?? t.feeUsdg,
    durationSec: c.tiers[i].durationSec ?? t.durationSec,
    // Real per-class melt rate. The shipped constants were an approximation
    // of a number the contract now states directly.
    bleedPctPerDay:
      c.tiers[i].bleedBps !== undefined
        ? c.tiers[i].bleedBps! / 100
        : t.bleedPctPerDay,
    posClass: c.tiers[i].posClass,
    fromChain: c.tiers[i].feeUsdg !== undefined,
  }))
}
