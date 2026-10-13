import { parseUnits } from 'viem'

/**
 * Demo mode — synthetic data for design work before the contracts exist.
 *
 * Set VITE_DEMO_MODE=true and every screen renders its populated state:
 * a ticking balance, locks mid-countdown, an expired position, agents of
 * each rank including one dead and one still revealing.
 *
 * The numbers are invented. The BEHAVIOUR is not — the balance decays through
 * the same `projectBalance` the live app uses, countdowns run against the same
 * clock, and states are derived rather than hardcoded, so what you're judging
 * is the real thing with fake inputs.
 *
 * Delete this file and the `if (DEMO)` branches in src/hooks to remove.
 */
export const DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

const now = () => Math.floor(Date.now() / 1000)

export const DEMO_DECIMALS = 18
export const DEMO_USDG_DECIMALS = 6

export const demo = {
  account: '0x5A1F7cB2Ae4d0913eE9F0c8B6f2a1D3c4E5b6A78' as const,

  /** ~5.94%/day — mid-band, so the strip doesn't show an edge case. */
  rateBps: 594,
  freeFloatRay: BigInt('614000000000000000000000000'),
  totalSupply: parseUnits('84210000', DEMO_DECIMALS),

  balance: parseUnits('14208.7731', DEMO_DECIMALS),
  /** Anchored once at module load so the projection decays from a fixed point. */
  balanceAnchorSec: now(),

  potBalance: parseUnits('312904.55', DEMO_DECIMALS),
  treasuryPending: parseUnits('18422.03', DEMO_DECIMALS),

  /** Tier 0 empty, tier 1 running, tier 2 expired — covers all three states. */
  locks: [
    { amount: 0n, unlockAt: 0 },
    { amount: parseUnits('2500', DEMO_DECIMALS), unlockAt: now() + 156_127 },
    { amount: parseUnits('9400', DEMO_DECIMALS), unlockAt: now() - 20_400 },
  ],
  fees: [
    parseUnits('3', DEMO_USDG_DECIMALS),
    parseUnits('5', DEMO_USDG_DECIMALS),
    parseUnits('10', DEMO_USDG_DECIMALS),
  ],
  durations: [86_400, 3 * 86_400, 14 * 86_400],

  epoch: 1_284,
  epochSec: 8 * 3600,
  epochStart: now() - 1_284 * 8 * 3600 - 11_050,

  buyTaxBps: 412,
  sellTaxBps: 683,

  /** One of each rank, one starving, one dead, one mid-reveal. */
  agents: [
    { id: 41n, tier: 0, fedAgo: 41_000, atkOffset: 0, revealed: true, dead: false, pending: 0n },
    { id: 58n, tier: 1, fedAgo: 12_400, atkOffset: 1, revealed: true, dead: false, pending: parseUnits('1840.22', DEMO_DECIMALS) },
    { id: 73n, tier: 2, fedAgo: 249_000, atkOffset: 0, revealed: true, dead: false, pending: 0n },
    { id: 77n, tier: 0, fedAgo: 300_000, atkOffset: 0, revealed: true, dead: true, pending: 0n },
    { id: 91n, tier: 0, fedAgo: 400, atkOffset: 0, revealed: false, dead: false, pending: 0n },
  ],
}
