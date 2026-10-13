import { MELT } from '../config/protocol'
import { bpsToPct, halfLifeDays, meltOver } from '../lib/melt'
import { num, pct } from '../lib/format'
import { useMeltingBalance, useHigherStats } from '../hooks/useHigher'
import { useAccount } from 'wagmi'
import { DEMO } from '../config/demo'

/**
 * §7: "Always show that HIGHER shrinks." This strip sits above every screen and
 * is never conditionally hidden — not while loading, not while a transaction
 * is pending, not on the trade screen where it is least flattering.
 *
 * The balance is projected forward from the last on-chain read (see
 * lib/melt.ts) so the digits move continuously. That is not decoration: the
 * number genuinely is falling, and a static figure would misrepresent it.
 */
export function MeltStrip() {
  const { isConnected: walletConnected } = useAccount()
  const isConnected = walletConnected || DEMO
  const { live, rateBps } = useMeltingBalance()
  const { freeFloatPct } = useHigherStats()

  const ratePct = rateBps === undefined ? undefined : bpsToPct(rateBps)
  const perDay = live !== undefined && rateBps !== undefined
    ? meltOver(live, 86_400, rateBps)
    : undefined

  return (
    <div className="strip">
      <div className="strip-cell">
        <div className="strip-label">
          {isConnected ? 'Your HIGHER, right now' : 'Your HIGHER'}
        </div>
        <div className="balance">
          {live === undefined ? '—' : num(live, 4)}
          <span className="balance-unit">HIGHER</span>
        </div>
        {perDay !== undefined ? (
          <div className="muted loss">
            −{num(perDay, 4)} over the next 24 hours
          </div>
        ) : (
          <div className="muted">
            {isConnected ? 'Reading balance…' : 'Connect a wallet to see it.'}
          </div>
        )}
      </div>

      <div className="strip-cell">
        <div className="strip-label">Melt rate today</div>
        <div className="figure loss">
          {ratePct === undefined ? '—' : pct(ratePct, 2)}
        </div>
        <div className="muted">
          per day, unlocked · floats {bpsToPct(MELT.minBps)}–{bpsToPct(MELT.maxBps)}%
          {rateBps !== undefined
            ? ` · half gone in ${halfLifeDays(rateBps).toFixed(1)} days`
            : ''}
        </div>
      </div>

      <div className="strip-cell">
        <div className="strip-label">Free float</div>
        <div className="figure">
          {freeFloatPct === undefined ? '—' : pct(freeFloatPct, 1)}
        </div>
        <div className="muted">of supply unlocked and melting</div>
      </div>
    </div>
  )
}
