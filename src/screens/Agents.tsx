import { Field, Gate, Notice, Pair } from '../components/ui'
import { MAX_AGENTS_PER_WALLET, MINT_PRICE_USDG, rankOf } from '../config/protocol'
import { useProtocolConstants, useRanks } from '../hooks/useProtocolConstants'
import { ConstantsWarning } from '../components/ConstantsWarning'
import { useAgentRoster, useAsyncResults } from '../hooks/useAgents'
import { useEpoch } from '../hooks/useEpoch'
import { useLockPositions } from '../hooks/useCayman'
import { useAgentPot } from '../hooks/useAgentPot'
import { useMeltingBalance } from '../hooks/useHigher'
import { duration, num, token, usdg } from '../lib/format'
import { AgentIcon } from '../components/win/Icons'
import { parseUnits, type Address } from 'viem'
import { irsAgentAbi } from '../abi'
import { addresses } from '../config/addresses'
import { useTx } from '../hooks/useTx'
import { TxLine } from '../components/TxLine'
import { PayToggle } from '../components/PayToggle'
import { useEthPay, useEthQuote } from '../hooks/useEthPay'

export function Agents() {
  const { agents, living, dead, refetch, configured } = useAgentRoster()
  const { reveals, audits, clearReveal, clearAudit } = useAsyncResults(refetch)
  const { epoch, secondsRemaining, claimWindow, settledThrough } = useEpoch()
  const { potBalance: potFallback } = useLockPositions()
  const { potPreview, paused, bondOk } = useAgentPot()
  const tx = useTx(refetch)
  const potBalance = potPreview ?? potFallback
  const { decimals } = useMeltingBalance()
  const ranks = useRanks()
  const consts = useProtocolConstants()
  const mintPrice = consts.mintPrice ?? MINT_PRICE_USDG
  const walletCap = consts.maxPerWallet ?? MAX_AGENTS_PER_WALLET
  const usdgDec = consts.usdgDecimals ?? 6
  const agentAddr = addresses.irsAgent as Address
  const usdgAddr = addresses.usdg as Address
  const usdgUnits = (v: number) => parseUnits(String(v), usdgDec)
  const pay = useEthPay(agentAddr, irsAgentAbi)
  const mintEth = useEthQuote(agentAddr, irsAgentAbi, usdgUnits(mintPrice), pay.useEth)

  /** ETH: send value (quote + 3% buffer, refunded), no approval. USDG: approve then call. */
  const payArgs = async (usdgAmount: bigint) => {
    if (pay.useEth) return { value: await pay.ethValue(usdgAmount), approvals: [] }
    await pay.checkUsdg(usdgAmount)
    return { value: undefined, approvals: [{ token: usdgAddr, spender: agentAddr, amount: usdgAmount, symbol: 'USDG' }] }
  }

  const mint = async () => {
    let p
    try { p = await payArgs(usdgUnits(mintPrice)) } catch (e) { return tx.fail('Mint agent', e) }
    return tx.run('Mint agent', { address: agentAddr, abi: irsAgentAbi, functionName: 'mint', value: p.value }, p.approvals)
  }
  const attack = (id: bigint) =>
    tx.run(`Agent #${id} audit`, {
      address: agentAddr,
      abi: irsAgentAbi,
      functionName: 'attack',
      args: [id],
    })
  const feed = async (id: bigint, feedUsdg: number) => {
    let p
    try { p = await payArgs(usdgUnits(feedUsdg)) } catch (e) { return tx.fail(`Feed agent #${id}`, e) }
    return tx.run(
      `Feed agent #${id}`,
      { address: agentAddr, abi: irsAgentAbi, functionName: 'feed', args: [id], value: p.value },
      p.approvals,
    )
  }
  const claim = async (id: bigint, claims: { epoch: number }[]) => {
    for (const c of claims) {
      const ok = await tx.run(`Claim agent #${id}, epoch ${c.epoch}`, {
        address: agentAddr,
        abi: irsAgentAbi,
        functionName: 'claim',
        args: [id, c.epoch],
      })
      if (!ok) break
    }
  }
  const reap = (id: bigint) =>
    tx.run(`Reap agent #${id}`, {
      address: agentAddr,
      abi: irsAgentAbi,
      functionName: 'reap',
      args: [id],
    })

  const epochClock = secondsRemaining === undefined ? null : duration(secondsRemaining)

  /** Claim window counts from the epoch a result was settled in (N-53), not from when it was played. */
  const claimDeadline =
    claimWindow === undefined ? '—' : `~${Math.round((claimWindow * 8) / 24)} days after settlement`

  /** Weighted average feed cost across the rank distribution — the number that
   *  makes the running cost of ownership concrete rather than abstract. */
  const expectedFeedPer3Days = ranks.reduce(
    (sum, r) => sum + (r.mintChancePct / 100) * r.feedUsdg,
    0,
  )

  return (
    <div className="stack">
      {/* §7: never imply guaranteed profit. This is the first thing on the
          screen, not a footnote under the mint button. */}
      <ConstantsWarning />

      {paused ? (
        <Notice kind="warn">
          <p>
            The game is paused by the operator. Minting, feeding, audits and
            claims are all unavailable until it is unpaused. Feed timers are not
            paused with it, so agents can starve while you are unable to feed
            them.
          </p>
        </Notice>
      ) : null}

      {bondOk === false ? (
        <Notice kind="warn">
          <p>
            Audits are blocked right now for everyone: the keeper's bond is below
            the pot. Minting and feeding still work; audits resume once the
            keeper tops up the bond.
          </p>
        </Notice>
      ) : null}

      <TxLine state={tx.state} onDismiss={tx.reset} />

      <Notice kind="warn">
        <p>
          This is gambling. Minting costs {usdg(mintPrice)} and three out
          of four agents come back Junior, which wins its audit 30% of the time
          and takes the smallest share when it does. Agents also cost roughly{' '}
          {usdg(expectedFeedPer3Days)} every three days to keep alive, forever.
          Most agents lose money over their lifetime. A few win. Very few win
          big.
        </p>
      </Notice>

      <div className="grid">
        <Field
          title="Mint an agent"
          note={`${usdg(mintPrice)} in USDG`}
        >
          <table className="rows">
            <thead>
              <tr>
                <th>Rank</th>
                <th className="n">Chance</th>
                <th className="n">Wins audit</th>
                <th className="n">Share weight</th>
                <th className="n">Feed / 3d</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r) => (
                <tr key={r.id}>
                  <td className={r.id === 2 ? 'special' : undefined}>{r.name}</td>
                  <td className="n">{r.mintChancePct}%</td>
                  <td className="n">{r.hitRatePct}%</td>
                  <td className="n">{r.weight}</td>
                  <td className="n">{usdg(r.feedUsdg)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <PayToggle supported={pay.supported} value={pay.payWith} onChange={pay.setPayWith} />
          <div className="btn-row">
            <button
              className="btn"
              disabled={!configured || paused || tx.busy || living.length >= walletCap}
              onClick={() => void mint()}
            >
              Mint for {usdg(mintPrice)}
              {pay.useEth && mintEth ? ` (${mintEth})` : ''}
            </button>
          </div>
          {pay.useEth ? (
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              Paid in ETH: the contract buys exactly {usdg(mintPrice)} in USDG on Uniswap and refunds
              the rest in the same transaction (3% buffer sent, ~0.3% pool fee actually paid). Feeding
              works the same way.
            </p>
          ) : null}
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {living.length} of {walletCap} agent slots used. Rank is
            random and revealed when the current 8-hour epoch ends — you are buying a
            75% chance of the weakest rank.
          </p>
        </Field>

        <Field title="This epoch" note={epoch !== undefined ? `epoch ${epoch}` : undefined}>
          <dl>
            <Pair
              label="Audit pool"
              value={
                potBalance === undefined ? '—' : `${token(potBalance, decimals, 2)} HIGHER`
              }
            />
            <Pair label="Epoch ends in" value={epochClock ?? '—'} />
            <Pair label="Audits per agent" value="1 per 8-hour epoch" />
            {settledThrough !== undefined ? (
              <Pair
                label="Settled through"
                value={settledThrough === 0 ? 'nothing yet' : `epoch ${settledThrough - 1}`}
              />
            ) : null}
            {claimWindow !== undefined ? (
              <Pair
                label="Claim winnings within"
                value={
                  <span className="loss">
                    {claimWindow} epoch{claimWindow === 1 ? '' : 's'}
                  </span>
                }
              />
            ) : null}
            <Pair label="Your living agents" value={String(living.length)} />
          </dl>
          {claimWindow !== undefined ? (
            <p className="muted loss" style={{ marginTop: '0.75rem' }}>
              Winnings are not sent to you — you have to claim them, and they
              expire. After {claimWindow} epoch
              {claimWindow === 1 ? '' : 's'} anyone can sweep an unclaimed
              payout and it is gone for good.
            </p>
          ) : null}
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Winners split the pool pari-mutuel by rank weight. The more agents
            that hit in an epoch, the smaller each share — the pool does not
            grow to match the number of winners.
          </p>
        </Field>
      </div>

      {/* Async VRF states. These sit above the roster so a pending result is
          visible without blocking anything else on the screen. */}
      {reveals.length > 0 || audits.length > 0 ? (
        <Field title="Results">
          <dl>
            {reveals.map((r) => (
              <Pair
                key={`rev-${r.id}`}
                label={`Agent #${r.id.toString()} revealed`}
                value={
                  <span className={r.rank === 2 ? 'special reveal' : 'reveal'}>
                    {rankOf(r.rank)?.name ?? 'Unknown'}{' '}
                    <button
                      className="btn secondary"
                      style={{ padding: '0 0.375rem', fontSize: '0.75rem' }}
                      onClick={() => clearReveal(r.id)}
                    >
                      Dismiss
                    </button>
                  </span>
                }
              />
            ))}
            {audits.map((a) => (
              <Pair
                key={`atk-${a.id}-${a.epoch}`}
                label={`Agent #${a.id.toString()} audit, epoch ${a.epoch.toString()}`}
                value={
                  <span className="reveal">
                    Placed — result after the epoch is settled{' '}
                    <button
                      className="btn secondary"
                      style={{ padding: '0 0.375rem', fontSize: '0.75rem' }}
                      onClick={() => clearAudit(a.id)}
                    >
                      Dismiss
                    </button>
                  </span>
                }
              />
            ))}
          </dl>
        </Field>
      ) : null}

      <Gate needs={['irsAgent', 'usdg']}>
        <Field title="Your agents" note={`${living.length} alive · ${dead.length} dead`}>
          {agents.length === 0 ? (
            <p className="muted">
              No agents yet. Read the odds above before minting one.
            </p>
          ) : (
            <table className="rows">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rank</th>
                  <th>Status</th>
                  <th className="n">Starves in</th>
                  <th className="n">Claimable</th>
                  <th className="n">Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const rank = rankOf(a.rank)
                  const starves = duration(a.secondsUntilStarving)
                  return (
                    <tr key={a.id.toString()}>
                      <td className="figure-sm">{a.id.toString()}</td>
                      <td className={a.rank === 2 ? 'special' : undefined}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <AgentIcon size={16} />
                          {!a.revealed || a.rank === null ? (
                            <span className="tag">revealing rank…</span>
                          ) : (
                            rank?.name ?? '—'
                          )}
                        </span>
                      </td>
                      <td>
                        {!a.revealed && !a.dead ? (
                          <span className="tag">awaiting rank</span>
                        ) : a.alive ? (
                          <span className="protected">Alive</span>
                        ) : (
                          <span className="stamp">Dead</span>
                        )}
                      </td>
                      <td className="n">
                        {!a.alive || !a.revealed ? '—' : (starves ?? <span className="loss">starving</span>)}
                      </td>
                      <td className="n">
                        {a.pendingLastEpoch === undefined
                          ? '—'
                          : num(Number(a.pendingLastEpoch) / 10 ** decimals, 2)}
                      </td>
                      <td className="n">
                        {a.pendingLastEpoch && a.pendingLastEpoch > 0n
                          ? claimDeadline
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {a.alive || (!a.revealed && !a.dead) ? (
                            <>
                              <button
                                className="btn secondary"
                                style={{ fontSize: '0.75rem', padding: '0.1875rem 0.5rem' }}
                                disabled={
                                  !a.canAttackThisEpoch || !a.revealed || paused || bondOk === false || tx.busy
                                }
                                title={
                                  !a.revealed
                                    ? 'Rank not revealed yet'
                                    : a.canAttackThisEpoch
                                      ? 'Run an audit this epoch'
                                      : 'Already audited this epoch'
                                }
                                onClick={() => void attack(a.id)}
                              >
                                Audit
                              </button>
                              <button
                                className="btn secondary"
                                style={{ fontSize: '0.75rem', padding: '0.1875rem 0.5rem' }}
                                disabled={!a.revealed || !rank || paused || tx.busy}
                                title={!a.revealed ? 'Feeding needs a revealed rank' : undefined}
                                onClick={() => rank && void feed(a.id, ranks[rank.id].feedUsdg)}
                              >
                                Feed {rank ? usdg(ranks[rank.id].feedUsdg) : ''}
                              </button>
                              {a.pendingLastEpoch && a.pendingLastEpoch > 0n ? (
                                <button
                                  className="btn"
                                  style={{ fontSize: '0.75rem', padding: '0.1875rem 0.5rem' }}
                                  disabled={tx.busy}
                                  onClick={() => void claim(a.id, a.claims)}
                                >
                                  Claim
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <button
                              className="btn danger"
                              style={{ fontSize: '0.75rem', padding: '0.1875rem 0.5rem' }}
                              disabled={tx.busy}
                              title="Remove a starved agent (frees the slot)"
                              onClick={() => void reap(a.id)}
                            >
                              Reap
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Claimable covers every epoch that still has something in it, summed.
            Epochs already swept are gone and are not listed.
          </p>
        </Field>
      </Gate>
    </div>
  )
}
