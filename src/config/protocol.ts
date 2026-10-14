/**
 * Expected values, used as fallbacks before the contracts are reachable and as
 * the copy on static pages.
 *
 * These are NOT authoritative. `useProtocolConstants` reads the real values
 * from the contracts and overrides everything here; when a contract value
 * disagrees with one of these, the difference is shown to the user rather than
 * quietly resolved. Treat a mismatch as a bug in this file, not in the chain.
 */

export const LOCK_TIERS = [
  {
    id: 0,
    name: '1 day',
    durationSec: 86_400,
    feeUsdg: 3,
    bleedPctPerDay: 2.07,
    summary: 'Partial cover: melts at 0.3× the base rate, and that melt goes to the audit pool.',
  },
  {
    id: 1,
    name: '3 days',
    durationSec: 3 * 86_400,
    feeUsdg: 5,
    bleedPctPerDay: 1.38,
    summary: 'Better cover: melts at 0.2× the base rate, into the audit pool.',
  },
  {
    id: 2,
    name: '14 days',
    durationSec: 14 * 86_400,
    feeUsdg: 10,
    bleedPctPerDay: 0.69,
    summary: 'Strongest cover: melts at 0.1× the base rate, into the audit pool.',
  },
] as const

export type LockTier = (typeof LOCK_TIERS)[number]
export type TierId = 0 | 1 | 2

/**
 * An expired position melts like an unlocked balance again (factor 1.0, 4.2–6.9 %/day
 * depending on how much is locked) and that melt is burned, not paid to the pot.
 * Upper bound shown as fallback; screens prefer the live rate.
 */
export const EXPIRED_BLEED_PCT_PER_DAY = 6.9

export const AGENT_RANKS = [
  {
    id: 0,
    name: 'Junior',
    mintChancePct: 75,
    hitRatePct: 30,
    weight: 4,
    feedUsdg: 10,
  },
  {
    id: 1,
    name: 'Senior',
    mintChancePct: 20,
    hitRatePct: 50,
    weight: 27,
    feedUsdg: 20,
  },
  {
    id: 2,
    name: 'Special',
    mintChancePct: 5,
    hitRatePct: 75,
    weight: 144,
    feedUsdg: 30,
  },
] as const

export type AgentRank = (typeof AGENT_RANKS)[number]
export type RankId = 0 | 1 | 2

export const MINT_PRICE_USDG = 99
export const FEED_INTERVAL_SEC = 3 * 86_400
export const EPOCH_SEC = 8 * 3600
export const MAX_AGENTS_PER_WALLET = 10

/** Trading tax bounds, for the "it can go this high" disclosure. */
export const TAX = {
  baseBps: 400,
  maxSellBps: 800,
  /** Buys are flat at baseBps outside the launch hour (oracle since 14 Oct 2026). */
  maxBuyBps: 400,
  floorBps: 400,
}

/** Melt rate bounds in bps/day. */
export const MELT = { minBps: 420, maxBps: 690 }

export function rankOf(id: number | undefined | null): AgentRank | null {
  if (id === undefined || id === null) return null
  return AGENT_RANKS.find((r) => r.id === id) ?? null
}

export function tierOf(id: number): LockTier | null {
  return LOCK_TIERS.find((t) => t.id === id) ?? null
}

/**
 * Expected value of one audit, ignoring the pool's size — used to state the
 * feed cost honestly. An agent must clear this much per 3 days just to break
 * even on food, before mint cost is repaid.
 */
export function feedCostPerEpoch(rank: AgentRank): number {
  const epochsPerFeedCycle = FEED_INTERVAL_SEC / EPOCH_SEC // 9
  return rank.feedUsdg / epochsPerFeedCycle
}
