import { useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { Field, Gate, Notice, Pair } from '../components/ui'
import { tierOf } from '../config/protocol'
import { useProtocolConstants, useTiers } from '../hooks/useProtocolConstants'
import { ConstantsWarning } from '../components/ConstantsWarning'
import { useLockPositions } from '../hooks/useCayman'
import { useMeltingBalance } from '../hooks/useHigher'
import { duration, num, token, usdg } from '../lib/format'
import type { Address } from 'viem'
import { caymanAbi } from '../abi'
import { addresses } from '../config/addresses'
import { useTx } from '../hooks/useTx'
import { TxLine } from '../components/TxLine'
import { PayToggle } from '../components/PayToggle'
import { useEthPay } from '../hooks/useEthPay'

export function Cayman() {
  const { positions, potBalance, minLock, configured, refetch } = useLockPositions()
  const { decimals, live } = useMeltingBalance()
  const tx = useTx(refetch)
  const vault = addresses.cayman as Address
  const pay = useEthPay(vault, caymanAbi)
  /** Fee in ETH (value, refunded buffer) or USDG (approval). */
  const feePay = async (fee: bigint | undefined) => {
    if (fee === undefined) return { value: undefined, approvals: [] }
    return pay.useEth
      ? { value: await pay.ethValue(fee), approvals: [] }
      : { value: undefined, approvals: [{ token: addresses.usdg as Address, spender: vault, amount: fee, symbol: 'USDG' }] }
  }
  const lock = async (tier: number, raw: string, fee: bigint | undefined) => {
    const label = `Lock ${tierOf(tier)?.name}`
    const amount = parseUnits(raw, decimals)
    // The token reverts with a bare "balance", which wallets mis-translate as "not enough ETH".
    if (live !== undefined && amount > parseUnits(live.toFixed(decimals > 6 ? 6 : decimals), decimals))
      return tx.fail(label, new Error(`You only have ${num(live, 2)} HIGHER unlocked.`))
    let f
    try { f = await feePay(fee) } catch (e) { return tx.fail(label, e) }
    // HIGHER is a scaled-balance token: transferFrom may consume a few wei more
    // allowance than it moves, so approve 1% over rather than unlimited.
    return tx.run(
      label,
      { address: vault, abi: caymanAbi, functionName: 'lock', args: [tier, amount], value: f.value },
      [
        { token: addresses.higher as Address, spender: vault, amount: (amount * 101n) / 100n, symbol: 'HIGHER' },
        ...f.approvals,
      ],
    )
  }
  const relock = async (tier: number, name: string, fee: bigint | undefined) => {
    let f
    try { f = await feePay(fee) } catch (e) { return tx.fail(`Relock ${name}`, e) }
    return tx.run(
      `Relock ${name}`,
      { address: vault, abi: caymanAbi, functionName: 'relock', args: [tier], value: f.value },
      f.approvals,
    )
  }
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const tiers = useTiers()
  const { usdgDecimals } = useProtocolConstants()

  const expired = positions.filter((p) => p.isExpired)

  /** Guard the button rather than letting the contract reject it. */
  const belowMin = (raw: string | undefined) => {
    if (minLock === undefined || !raw) return false
    try {
      return parseUnits(raw, decimals) < minLock
    } catch {
      return true
    }
  }

  return (
    <div className="stack">
      <ConstantsWarning />
      <TxLine state={tx.state} onDismiss={tx.reset} />
      {pay.supported ? (
        <Field title="Lock fees" note={pay.useEth ? 'paid in ETH' : 'paid in USDG'}>
          <PayToggle supported={pay.supported} value={pay.payWith} onChange={pay.setPayWith} />
          {pay.useEth ? (
            <p className="muted">
              The USDG fee is bought for you on Uniswap from the ETH you send; the unused ETH comes
              back in the same transaction. You still approve HIGHER once.
            </p>
          ) : null}
        </Field>
      ) : null}
      {expired.length > 0 ? (
        <Notice kind="warn">
          <p>
            <span className="stamp">Expired</span>{' '}
            {expired.length === 1 ? 'A position has' : `${expired.length} positions have`}{' '}
            run out and {expired.length === 1 ? 'is' : 'are'} melting again at the
            full unlocked rate, and that melt is burned. Relock or withdraw.
          </p>
        </Notice>
      ) : null}

      <Field
        title="Offshore vaults"
        note={
          potBalance !== undefined
            ? `audit pool holds ${token(potBalance, decimals, 2)} HIGHER`
            : undefined
        }
      >
        <p>
          Locking moves HIGHER out of reach of the melt. Longer locks protect
          more. Whatever a locked position still loses goes into the audit pool
          that IRS Agents fight over — including the penalty on an expired
          position.
        </p>
        {minLock !== undefined ? (
          <p className="muted">
            Minimum lock: {token(minLock, decimals, 2)} HIGHER. Anything smaller
            is rejected by the contract — the transaction fails and you pay gas
            for nothing.
          </p>
        ) : null}
        {live !== undefined ? (
          <p className="muted">
            Unlocked and melting right now: {num(live, 4)} HIGHER.
          </p>
        ) : null}
      </Field>

      <Gate needs={['cayman', 'higher', 'usdg']}>
        <div className="grid">
          {tiers.map((tier) => {
            const pos = positions.find((p) => p.tier === tier.id)
            const feeOnChain = pos?.fee
            const remaining = pos?.secondsRemaining ?? 0
            const clock = duration(remaining)

            return (
              <Field
                key={tier.id}
                title={`${tier.name} lock`}
                note={
                  feeOnChain !== undefined
                    ? `fee ${usdg(Number(formatUnits(feeOnChain, usdgDecimals)))}`
                    : `fee ${usdg(tier.feeUsdg)}`
                }
              >
                <p className="muted">{tier.summary}</p>

                <dl>
                  <Pair
                    label="Bleed while locked"
                    value={
                      tier.bleedPctPerDay === 0 ? (
                        <span className="protected">0%/day</span>
                      ) : (
                        <span className="loss">
                          {tier.bleedPctPerDay.toFixed(2)}%/day
                        </span>
                      )
                    }
                  />
                  <Pair label="Fee to lock or relock" value={usdg(tier.feeUsdg)} />
                  <Pair
                    label="Protected here"
                    value={
                      <span className="protected">
                        {token(pos?.amount, decimals)}
                      </span>
                    }
                  />
                  {pos?.hasPosition ? (
                    <Pair
                      label={pos.isExpired ? 'Expired' : 'Unlocks in'}
                      value={
                        pos.isExpired ? (
                          <span className="stamp">Expired</span>
                        ) : (
                          clock ?? '—'
                        )
                      }
                    />
                  ) : null}
                </dl>

                {pos?.isExpired ? (
                  <p className="muted loss" style={{ marginTop: '0.5rem' }}>
                    Melting at the full unlocked rate (burned) until you relock or
                    withdraw.
                  </p>
                ) : null}

                <label htmlFor={`amt-${tier.id}`} style={{ marginTop: '0.75rem' }}>
                  HIGHER to lock
                </label>
                <input
                  id={`amt-${tier.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amounts[tier.id] ?? ''}
                  onChange={(e) =>
                    setAmounts((a) => ({ ...a, [tier.id]: e.target.value }))
                  }
                />

                <div className="btn-row">
                  <button
                    className="btn"
                    disabled={
                      !configured ||
                      tx.busy ||
                      !amounts[tier.id] ||
                      belowMin(amounts[tier.id])
                    }
                    onClick={() => void lock(tier.id, amounts[tier.id] ?? '0', feeOnChain)}
                  >
                    Lock
                  </button>
                  <button
                    className="btn secondary"
                    disabled={!pos?.hasPosition || tx.busy}
                    onClick={() => void relock(tier.id, tier.name, feeOnChain)}
                  >
                    Relock
                  </button>
                  <button
                    className="btn secondary"
                    disabled={!pos?.hasPosition || tx.busy || (!pos?.isExpired && remaining > 0)}
                    onClick={() =>
                      void tx.run(`Withdraw ${tier.name}`, {
                        address: vault,
                        abi: caymanAbi,
                        functionName: 'unlock',
                        args: [tier.id],
                      })
                    }
                  >
                    Withdraw
                  </button>
                </div>

                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Locking costs {usdg(tier.feeUsdg)} {pay.useEth ? '(paid in ETH)' : 'in USDG'} plus gas.
                  Relocking costs the fee again.
                </p>
              </Field>
            )
          })}
        </div>
      </Gate>

      <Field title="What locking does not do">
        <p>
          A lock protects HIGHER from the melt. It does not protect its price. A
          fully locked 14-day position keeps every token it started with and can
          still be worth less when you withdraw.
        </p>
        <p className="muted">
          Fees are charged per lock and per relock, not per day. Over 14 days,
          three sequential 1-day locks cost more in fees than one 14-day lock
          and protect less. {tierOf(2)?.name} is the cheapest full protection.
        </p>
      </Field>
    </div>
  )
}
