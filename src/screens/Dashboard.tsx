import type { Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { erc20Abi, higherAbi } from '../abi'
import { addresses, configured as isConfigured } from '../config/addresses'
import { Field, Pair } from '../components/ui'
import { MintStatus } from '../components/MintStatus'
import { useHigherStats } from '../hooks/useHigher'
import { useLockPositions } from '../hooks/useCayman'
import { useEpoch } from '../hooks/useEpoch'
import { bpsToPct, halfLifeDays } from '../lib/melt'
import { duration, pct, token } from '../lib/format'
import { MELT } from '../config/protocol'
import { DEMO, demo } from '../config/demo'

export function Dashboard() {
  const { rateBps, freeFloatPct, totalSupply, decimals } = useHigherStats()
  const { potBalance, potSettled, expiredPrincipal } = useLockPositions()
  const { epoch, secondsRemaining } = useEpoch()

  // Tax accrues on the token contract itself (taxWallet = address(this)) and
  // swapTax() converts it HIGHER -> SPY -> reserve. The reserve address is fixed.
  const h = { address: addresses.higher as Address, abi: higherAbi } as const
  const { data: tre } = useReadContracts({
    contracts: [
      { ...h, functionName: 'balanceOf', args: [addresses.higher as Address] },
      { ...h, functionName: 'swapThreshold' },
      { ...h, functionName: 'swapReserve' },
    ],
    query: { enabled: isConfigured('higher') && !DEMO, refetchInterval: 15_000 },
  })
  const reserveAddr = tre?.[2]?.status === 'success' ? (tre[2].result as Address) : undefined
  const { data: res } = useReadContracts({
    contracts: [
      { address: addresses.spy as Address, abi: erc20Abi, functionName: 'balanceOf', args: [reserveAddr as Address] },
    ],
    query: { enabled: !!reserveAddr && isConfigured('spy') && !DEMO, refetchInterval: 30_000 },
  })
  const treasury = DEMO
    ? demo.treasuryPending
    : tre?.[0]?.status === 'success'
      ? (tre[0].result as bigint)
      : undefined
  const threshold = tre?.[1]?.status === 'success' ? (tre[1].result as bigint) : undefined
  const reserveSpy = res?.[0]?.status === 'success' ? (res[0].result as bigint) : undefined

  const lockedPct = freeFloatPct === undefined ? undefined : 100 - freeFloatPct
  const clock = secondsRemaining === undefined ? null : duration(secondsRemaining)

  return (
    <div className="stack">
      <MintStatus />
      <div className="grid">
        <Field title="Supply">
          <dl>
            <Pair label="Total supply" value={token(totalSupply, decimals, 0)} />
            <Pair
              label="Locked offshore"
              value={
                <span className="protected">
                  {lockedPct === undefined ? '—' : pct(lockedPct, 1)}
                </span>
              }
            />
            <Pair
              label="Free float"
              value={freeFloatPct === undefined ? '—' : pct(freeFloatPct, 1)}
            />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            The melt rate falls as more of the supply locks up, so these two
            numbers move together.
          </p>
        </Field>

        <Field title="Melt">
          <dl>
            <Pair
              label="Rate today"
              value={
                <span className="loss">
                  {rateBps === undefined ? '—' : pct(bpsToPct(rateBps))}
                </span>
              }
            />
            <Pair
              label="Range"
              value={`${bpsToPct(MELT.minBps)}–${bpsToPct(MELT.maxBps)}% per day`}
            />
            <Pair
              label="Half-life"
              value={
                rateBps === undefined
                  ? '—'
                  : `${halfLifeDays(rateBps).toFixed(1)} days`
              }
            />
          </dl>
        </Field>

        <Field title="Audit pool" note={epoch !== undefined ? `epoch ${epoch}` : undefined}>
          <dl>
            <Pair
              label="Pool size"
              value={potBalance === undefined ? '—' : token(potBalance, decimals, 2)}
            />
            <Pair
              label="of which collected"
              value={potSettled === undefined ? '—' : token(potSettled, decimals, 2)}
            />
            <Pair
              label="Expired, melting at full rate"
              value={
                expiredPrincipal === undefined ? (
                  '—'
                ) : (
                  <span className="loss">{token(expiredPrincipal, decimals, 2)}</span>
                )
              }
            />
            <Pair label="Epoch ends in" value={clock ?? '—'} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Fed only by the melt of active locks (0.3× / 0.2× / 0.1× the base
            rate). Unlocked and pool melt is burned, not paid in. The last figure
            is principal in positions whose lock has run out: it melts at the
            full rate again and that melt is burned.
          </p>
        </Field>

        <Field title="Treasury">
          <dl>
            <Pair
              label="Tax awaiting conversion"
              value={`${token(treasury, decimals, 2)} HIGHER`}
            />
            <Pair
              label="Converts from"
              value={threshold === undefined ? '—' : `${token(threshold, decimals, 0)} HIGHER`}
            />
            <Pair
              label="Reserve holds"
              value={reserveSpy === undefined ? '—' : `${token(reserveSpy, 18, 6)} SPY`}
            />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Trading tax collects on the token contract and swapTax() converts it
            to SPY, sent to a reserve address that is fixed in the contract. Anyone
            can call swapTax() and earns 0.25%; each call converts at most 0.1% of
            the pool so it never moves the price much.
          </p>
        </Field>
      </div>
    </div>
  )
}
