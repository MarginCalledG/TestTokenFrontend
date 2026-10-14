import { useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useLockPositions } from '../hooks/useCayman'
import { useAgentRoster } from '../hooks/useAgents'
import { useChainClock } from '../hooks/useChainClock'
import { LOCK_TIERS } from '../config/protocol'

type Reminder = { key: string; kind: 'warn' | 'calm'; text: string; open: string; action: string }

/** "2 h 15 min" / "3 days" — coarse on purpose, these are nudges. */
function inWords(sec: number): string {
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} min`
  if (sec < 2 * 86_400) {
    const h = Math.floor(sec / 3600)
    const m = Math.round((sec % 3600) / 60)
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${Math.round(sec / 86_400)} days`
}

const SOON_LOCK = 6 * 3600 // lock runs out within 6 h
const SOON_STARVE = 24 * 3600 // agent starves within a day

/**
 * Everything with a deadline that belongs to the connected wallet, gathered in one place:
 * locks about to run out or already expired (they melt at the full rate again), agents that
 * need feeding, winnings waiting to be claimed. Click opens the window that fixes it.
 */
export function Reminders({ open }: { open: (id: string) => void }) {
  const { isConnected } = useAccount()
  const { nowSec } = useChainClock(1000)
  const { positions } = useLockPositions()
  const { agents } = useAgentRoster()
  const [hidden, setHidden] = useState<Record<string, true>>({})
  if (!isConnected) return null

  const list: Reminder[] = []
  for (const p of positions) {
    if (!p.hasPosition) continue
    const name = LOCK_TIERS[p.tier]?.name ?? `tier ${p.tier}`
    const left = p.unlockAt - nowSec
    if (p.isExpired || left <= 0)
      list.push({
        key: `lock-exp-${p.tier}`,
        kind: 'warn',
        text: `Your ${name} lock has run out and is melting at the full rate again.`,
        open: 'cayman',
        action: 'Withdraw or relock',
      })
    else if (left < SOON_LOCK)
      list.push({
        key: `lock-soon-${p.tier}`,
        kind: 'calm',
        text: `Your ${name} lock runs out in ${inWords(left)}.`,
        open: 'cayman',
        action: 'Open vaults',
      })
  }
  let claimable = 0n
  for (const a of agents) {
    claimable += a.pendingLastEpoch ?? 0n
    if (a.dead || !a.alive) continue
    const left = a.starvesAt - nowSec
    if (left < SOON_STARVE)
      list.push({
        key: `starve-${a.id}`,
        kind: 'warn',
        text: left > 0 ? `Agent #${a.id} starves in ${inWords(left)}.` : `Agent #${a.id} is starving.`,
        open: 'agents',
        action: 'Feed it',
      })
    if (a.revealed && a.canAttackThisEpoch && a.secondsUntilStarving > 0)
      list.push({
        key: `audit-${a.id}`,
        kind: 'calm',
        text: `Agent #${a.id} has not audited this epoch yet.`,
        open: 'agents',
        action: 'Audit',
      })
  }
  if (claimable > 0n)
    list.push({
      key: 'claim',
      kind: 'calm',
      text: `You have ${Number(formatUnits(claimable, 18)).toLocaleString('en-US', { maximumFractionDigits: 0 })} HIGHER in agent winnings to claim.`,
      open: 'agents',
      action: 'Claim',
    })

  const shown = list.filter((r) => !hidden[r.key])
  if (shown.length === 0) return null
  return (
    <div className="reminders" role="status">
      {shown.map((r) => (
        <div key={r.key} className={`reminder raised ${r.kind}`}>
          <button className="reminder-x" aria-label="Dismiss" onClick={() => setHidden((h) => ({ ...h, [r.key]: true }))}>
            ×
          </button>
          <p>{r.text}</p>
          <button className="btn" onClick={() => open(r.open)}>
            {r.action}
          </button>
        </div>
      ))}
    </div>
  )
}
