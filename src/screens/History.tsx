import { Field, Notice, Pair } from '../components/ui'
import { LineChart } from '../components/LineChart'
import { useHistory, type AgentEvent, type LockEvent } from '../hooks/useHistory'
import { explorerAddress } from '../config/chains'
import { AGENT_RANKS, LOCK_TIERS } from '../config/protocol'
import { short } from '../lib/format'

function compact(v: number): string {
  const a = Math.abs(v)
  const [d, s] = a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, '']
  return `${(v / d).toLocaleString('en-US', { maximumFractionDigits: 2 })}${s}`
}
function price(v: number): string {
  if (v >= 0.01) return `$${v.toFixed(2)}`
  const zeros = Math.floor(-Math.log10(v))
  const digits = Math.round(v * 10 ** (zeros + 3)).toString().slice(0, 3)
  const sub = String(zeros).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]).join('')
  return `$0.0${sub}${digits}`
}
const when = (t: number) =>
  new Date(t * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const rank = (tier?: number) => (tier === undefined ? '' : AGENT_RANKS[tier]?.name ?? `rank ${tier}`)

function describe(e: AgentEvent | LockEvent): string {
  switch (e.type) {
    case 'minted':
      return `Agent #${e.id} minted`
    case 'revealed':
      return `Agent #${e.id} revealed: ${rank(e.tier)}`
    case 'audit':
      return `Agent #${e.id} audited (epoch ${e.epoch})`
    case 'claimed':
      return `Agent #${e.id} claimed ${compact(e.amount ?? 0)} HIGHER (epoch ${e.epoch})`
    case 'died':
      return `Agent #${e.id} starved`
    case 'lock':
      return `${short(e.user)} locked ${compact(e.amount)} HIGHER for ${LOCK_TIERS[e.tier]?.name}`
    case 'withdraw':
      return `${short(e.user)} withdrew ${compact(e.amount)} HIGHER (${LOCK_TIERS[e.tier]?.name})`
  }
}

export function History() {
  const { data, isLoading, error } = useHistory()
  if (isLoading) return <p className="muted">Loading history…</p>
  if (error || !data)
    return (
      <Notice kind="warn">
        <p>The history service is not reachable right now. Everything else on the site reads the chain directly and still works.</p>
      </Notice>
    )

  const snaps = data.snaps
  const lockedTotal = (s: (typeof snaps)[number]) => s.locked[0] + s.locked[1] + s.locked[2]
  const first = snaps[0]
  const last = snaps.at(-1)
  const activity = [...data.agentEvents, ...data.lockEvents].sort((a, b) => b.t - a.t).slice(0, 40)

  return (
    <div className="stack">
      <div className="grid">
        <Field title="Price" note="since launch">
          <LineChart points={data.price.filter((p): p is [number, number] => p[1] !== null)} format={price} color="#006000" />
        </Field>
        <Field title="Supply" note={first ? `recorded since ${when(first.t)}` : undefined}>
          <LineChart points={snaps.map((s) => [s.t, s.supply])} format={(v) => `${compact(v)} HIGHER`} color="#a00000" />
          {last ? (
            <p className="muted" style={{ marginTop: 6 }}>
              {compact(data.launchSupply - last.supply)} HIGHER (
              {(((data.launchSupply - last.supply) / data.launchSupply) * 100).toFixed(2)}%) melted since launch.
            </p>
          ) : null}
        </Field>
        <Field title="Locked offshore">
          <LineChart points={snaps.map((s) => [s.t, lockedTotal(s)])} format={(v) => `${compact(v)} HIGHER`} />
        </Field>
        <Field title="Holders" note={data.holders !== null ? `${data.holders} now` : undefined}>
          <LineChart
            points={snaps.filter((s) => s.holders !== null).map((s) => [s.t, s.holders as number])}
            format={(v) => String(Math.round(v))}
            color="#804000"
          />
          <p className="muted" style={{ marginTop: 6 }}>Wallets holding at least 1 HIGHER, not counting the pool and protocol contracts.</p>
        </Field>
        <Field title="Audit pool">
          <LineChart points={snaps.map((s) => [s.t, s.pot])} format={(v) => `${compact(v)} HIGHER`} color="#600080" />
        </Field>
        <Field title="Pool liquidity">
          <LineChart points={snaps.map((s) => [s.t, s.liquidityUsd])} format={(v) => `$${v.toFixed(0)}`} color="#006060" />
        </Field>
      </div>

      <Field title="Audit rounds" note={`${data.rounds.length} with audits`}>
        {data.rounds.length === 0 ? (
          <p className="muted">No agent has audited yet.</p>
        ) : (
          <table className="rows">
            <thead>
              <tr>
                <th>Epoch</th>
                <th>Started</th>
                <th>Audits</th>
                <th>Agents</th>
                <th>Claimed so far</th>
              </tr>
            </thead>
            <tbody>
              {data.rounds.map((r) => (
                <tr key={r.epoch}>
                  <td className="n">{r.epoch}</td>
                  <td>{when(r.start)}</td>
                  <td className="n">{r.audits}</td>
                  <td>{r.agents.map((a) => `#${a}`).join(', ')}</td>
                  <td className="n">{r.claimed ? `${compact(r.claimed)} HIGHER` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Field>

      <Field title="Recent activity">
        {activity.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <dl>
            {activity.map((e, i) => (
              <Pair
                key={i}
                label={
                  'user' in e ? (
                    <a href={explorerAddress(e.user)} target="_blank" rel="noreferrer">
                      {describe(e)}
                    </a>
                  ) : (
                    describe(e)
                  )
                }
                value={<span className="muted">{when(e.t)}</span>}
              />
            ))}
          </dl>
        )}
      </Field>
      <p className="muted">
        Recorded by the HIGHER indexer, last block {data.block.toLocaleString()}. Price history comes from the pool since launch;
        supply, locks, holders and liquidity are recorded every 5 minutes from when the indexer started.
      </p>
    </div>
  )
}
