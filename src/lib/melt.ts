/**
 * Demurrage math.
 *
 * ⚠️  ONE ASSUMPTION, ONE PLACE. `balanceOf` is a deterministic function of
 * block.timestamp, so interpolating forward from the last read is not
 * speculation — it reproduces what the contract would return right now. That's
 * only true if we use the SAME decay curve the contract uses, and the brief
 * doesn't say which it is:
 *
 *   discrete   index(t) = (1 - r)^(t / 1 day)
 *   continuous index(t) = exp(-r * t / 1 day)
 *
 * At r = 6.9%/day these diverge by ~0.25% after a single day, which is very
 * visible on a balance. Read the index update in Higher.sol and set MODEL to
 * match. If they disagree the displayed balance drifts away from the contract
 * over the course of a session, which is exactly the failure §7 forbids.
 */
export type DecayModel = 'discrete' | 'continuous'

/**
 * Fallback only. The contract exposes `perSecFactor()` — the exact multiplier
 * it applies to the index each second — so `decayFromFactor` below is what the
 * app actually uses and there is no longer any curve to assume. This constant
 * survives purely for the case where that read fails.
 */
export const MODEL: DecayModel = 'discrete'

const DAY = 86_400

const RAY = 1e27

/**
 * The exact decay, straight from the contract.
 *
 * `perSecFactor()` is the RAY-scaled multiplier applied to the demurrage index
 * once per second, so the value remaining after n seconds is factor^n. Using
 * it means the displayed balance is not a model of what the contract does —
 * it is the same arithmetic, and it cannot drift.
 *
 * Returns null if the value isn't in a plausible range, which would mean the
 * RAY scaling assumption is wrong. Callers fall back to the rate-based curve
 * and the mismatch is visible in the console rather than silently wrong by a
 * few percent a day.
 */
export function decayFromFactor(
  seconds: number,
  perSecFactorRay: bigint | undefined,
): number | null {
  if (perSecFactorRay === undefined || seconds <= 0) return seconds <= 0 ? 1 : null
  const f = Number(perSecFactorRay) / RAY
  // 6.9%/day is ~0.99999917 per second; anything outside this band means the
  // scale isn't RAY and the result would be nonsense.
  if (!(f > 0.99999 && f <= 1)) {
    console.warn('[melt] perSecFactor outside expected range, got', f)
    return null
  }
  return Math.pow(f, seconds)
}

/** Fallback curve, used only when perSecFactor is unavailable. */
export function decayFactor(seconds: number, ratePerDayBps: number): number {
  if (seconds <= 0) return 1
  const r = ratePerDayBps / 10_000
  const days = seconds / DAY
  return MODEL === 'discrete' ? Math.pow(1 - r, days) : Math.exp(-r * days)
}

/**
 * Project a balance forward. Returns a float for DISPLAY ONLY.
 *
 * Never feed this into a transaction amount. It is correct to within the
 * decay model but it is not the number the contract will use at settlement —
 * a tx lands at the next block's timestamp and consumes marginally less. Use
 * the exact on-chain bigint, or a "max" path where the contract reads the
 * balance itself.
 */
export function projectBalance(
  onChain: bigint,
  decimals: number,
  elapsedSec: number,
  ratePerDayBps: number,
  perSecFactorRay?: bigint,
): number {
  const base = Number(onChain) / 10 ** decimals
  const exact = decayFromFactor(elapsedSec, perSecFactorRay)
  return base * (exact ?? decayFactor(elapsedSec, ratePerDayBps))
}

/** How much a balance loses over a window, in token units. */
export function meltOver(
  amount: number,
  seconds: number,
  ratePerDayBps: number,
): number {
  return amount - amount * decayFactor(seconds, ratePerDayBps)
}

/** Human framing: "half of it is gone in N days". */
export function halfLifeDays(ratePerDayBps: number): number {
  const r = ratePerDayBps / 10_000
  if (r <= 0) return Infinity
  return MODEL === 'discrete'
    ? Math.log(0.5) / Math.log(1 - r)
    : Math.log(2) / r
}

/** instantFreeFloatRay() is 1e27-scaled. */
export function rayToPct(ray: bigint): number {
  return (Number(ray) / 1e27) * 100
}

export function bpsToPct(bps: number | bigint): number {
  return Number(bps) / 100
}
