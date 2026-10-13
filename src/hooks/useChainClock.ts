import { useEffect, useRef, useState } from 'react'
import { useBlock } from 'wagmi'

/**
 * A ticking "current chain second".
 *
 * Everything time-based in this app — the melt tick, lock countdowns, feed
 * timers, the epoch clock — has to agree with `block.timestamp`, because that
 * is what the contracts read. A user whose laptop clock is ten minutes fast
 * would otherwise see a lock report itself unlocked before it is.
 *
 * Estimating the offset: a block's timestamp is always slightly in the past
 * (it was mined N seconds ago), so `blockTs - localNow` under-reads the true
 * offset by the block's age. Taking the running MAXIMUM of that difference
 * converges on the true offset from below, since the freshest block we ever
 * observe has the smallest age. We only apply it once it exceeds a threshold,
 * so a normally-synced clock is left alone rather than nudged by block jitter.
 */
const APPLY_OFFSET_ABOVE_MS = 20_000

export function useChainClock(intervalMs = 250) {
  const { data: block } = useBlock({ watch: true })
  const offsetRef = useRef<number | null>(null)
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!block) return
    const observed = Number(block.timestamp) * 1000 - Date.now()
    if (offsetRef.current === null || observed > offsetRef.current) {
      offsetRef.current = observed
    }
  }, [block])

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  const offset = offsetRef.current ?? 0
  const applied = Math.abs(offset) > APPLY_OFFSET_ABOVE_MS ? offset : 0

  return {
    /** Current chain time, in seconds, as a float. */
    nowSec: (Date.now() + applied) / 1000,
    /** True when we corrected for a badly-set local clock — worth surfacing. */
    clockCorrected: applied !== 0,
    offsetSec: applied / 1000,
    blockNumber: block?.number,
  }
}
