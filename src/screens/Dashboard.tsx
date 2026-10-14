import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { caymanAbi, erc20Abi, higherAbi, irsAgentAbi, seedAbi, v2PairAbi } from '../abi'
import { addresses, configured as isConfigured } from '../config/addresses'
import { Field, Pair } from '../components/ui'
import { MintStatus } from '../components/MintStatus'
import { useHigherStats } from '../hooks/useHigher'
import { useEpoch } from '../hooks/useEpoch'
import { useUsdPrices } from '../hooks/useUsdPrices'
import { bpsToPct, halfLifeDays } from '../lib/melt'
import { duration, pct } from '../lib/format'
import { MELT } from '../config/protocol'
import { DEMO } from '../config/demo'

const RAY = 10n ** 27n
const TIERS = ['1 day', '3 days', '14 days'] as const

/** 64.5B / 985.7M / 24.3K — token amounts are too large for full digits on a dashboard. */
function compact(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const [d, s] = a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, '']
  return `${(v / d).toLocaleString('en-US', { maximumFractionDigits: 2 })}${s}`
}
function dollars(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  if (v !== 0 && Math.abs(v) < 0.01) return `$${v.toPrecision(2)}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
/** $0.0₈392 — the DEX-screener way of writing tiny prices. */
function price(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  if (v >= 0.01) return dollars(v)
  const zeros = Math.floor(-Math.log10(v)) // zeros after the decimal point
  const digits = Math.round(v * 10 ** (zeros + 3)).toString().slice(0, 3)
  const sub = String(zeros).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[Number(c)]).join('')
  return `$0.0${sub}${digits}`
}
/** Share in %, without rounding small but real amounts down to 0.0%. */
function share100(x: number): string {
  if (x === 0) return '0%'
  if (x < 0.01) return '<0.01%'
  return pct(x, x < 1 ? 2 : 1)
}
const n18 = (v: bigint | undefined) => (v === undefined ? undefined : Number(formatUnits(v, 18)))

/** "985.72M HIGHER · $6.71" */
function Amount({ v, px }: { v: number | undefined; px: number | undefined }) {
  return (
    <>
      {compact(v)} <span className="muted">· {v === undefined || px === undefined ? '—' : dollars(v * px)}</span>
    </>
  )
}

export function Dashboard() {
  const { rateBps, totalSupply } = useHigherStats()
  const { epoch, secondsRemaining } = useEpoch()
  const prices = useUsdPrices()
  const px = prices.higher

  const on = isConfigured('higher', 'cayman', 'irsAgent', 'pair', 'seed') && !DEMO
  const h = { address: addresses.higher as Address, abi: higherAbi } as const
  const v = { address: addresses.cayman as Address, abi: caymanAbi } as const
  const ag = { address: addresses.irsAgent as Address, abi: irsAgentAbi } as const
  const sd = { address: addresses.seed as Address, abi: seedAbi } as const

  // One multicall for everything the dashboard needs. Order matters: read by index below.
  const { data } = useReadContracts({
    contracts: [
      { ...h, functionName: 'launchSupply' }, // 0
      { ...h, functionName: 'balanceOf', args: [addresses.pair as Address] }, // 1 pool
      { ...h, functionName: 'balanceOf', args: [addresses.cayman as Address] }, // 2 vault
      { ...h, functionName: 'balanceOf', args: [addresses.higher as Address] }, // 3 tax pending
      { ...h, functionName: 'balanceOf', args: [addresses.seed as Address] }, // 4 keeper bond
      { ...h, functionName: 'ratePerDayBpsFor', args: [1] }, // 5 LP rate
      { ...h, functionName: 'ratePerDayBpsFor', args: [2] }, // 6
      { ...h, functionName: 'ratePerDayBpsFor', args: [3] }, // 7
      { ...h, functionName: 'ratePerDayBpsFor', args: [4] }, // 8
      { ...h, functionName: 'posIndex', args: [0] }, // 9
      { ...h, functionName: 'posIndex', args: [2] }, // 10
      { ...h, functionName: 'posIndex', args: [3] }, // 11
      { ...h, functionName: 'posIndex', args: [4] }, // 12
      { ...v, functionName: 'lockedScaled', args: [0n] }, // 13
      { ...v, functionName: 'lockedScaled', args: [1n] }, // 14
      { ...v, functionName: 'lockedScaled', args: [2n] }, // 15
      { ...v, functionName: 'expiredScaled' }, // 16
      { ...v, functionName: 'potBalance' }, // 17
      { ...ag, functionName: 'livingCount' }, // 18
      { ...ag, functionName: 'nextId' }, // 19
      { ...ag, functionName: 'currentEpoch' }, // 20
      { ...ag, functionName: 'settledThrough' }, // 21
      { ...ag, functionName: 'paused' }, // 22
      { ...sd, functionName: 'bondOk' }, // 23
      { ...sd, functionName: 'remaining' }, // 24
      { ...h, functionName: 'swapReserve' }, // 25
      { ...h, functionName: 'swapThreshold' }, // 26
    ],
    query: { enabled: on, refetchInterval: 15_000 },
  })
  const r = <T,>(i: number): T | undefined => (data?.[i]?.status === 'success' ? (data[i].result as T) : undefined)

  const curEpoch = r<number>(20)
  const reserveAddr = r<Address>(25)
  const { data: more } = useReadContracts({
    contracts: [
      { ...ag, functionName: 'attackersOf', args: [curEpoch ?? 0] },
      { address: addresses.usdg as Address, abi: erc20Abi, functionName: 'balanceOf', args: [reserveAddr as Address] },
      { address: addresses.spy as Address, abi: erc20Abi, functionName: 'balanceOf', args: [reserveAddr as Address] },
      { address: addresses.pair as Address, abi: v2PairAbi, functionName: 'token0' },
      { address: addresses.pair as Address, abi: v2PairAbi, functionName: 'getReserves' },
    ],
    query: { enabled: on && curEpoch !== undefined && !!reserveAddr, refetchInterval: 15_000 },
  })
  const m = <T,>(i: number): T | undefined => (more?.[i]?.status === 'success' ? (more[i].result as T) : undefined)

  /* ---- supply ---- */
  const launch = n18(r<bigint>(0))
  const supply = n18(totalSupply as bigint | undefined)
  const melted = launch !== undefined && supply !== undefined ? launch - supply : undefined
  const pool = n18(r<bigint>(1))
  const vaultBal = n18(r<bigint>(2))
  const taxPending = n18(r<bigint>(3))
  const bond = n18(r<bigint>(4))

  const idx = [9, 10, 11, 12].map((i) => r<bigint>(i))
  const scaled = [13, 14, 15].map((i) => r<bigint>(i))
  const lockedByTier = scaled.map((s, b) =>
    s === undefined || idx[b + 1] === undefined ? undefined : n18((s * idx[b + 1]!) / RAY),
  )
  const expiredScaled = r<bigint>(16)
  const expired = expiredScaled === undefined || idx[0] === undefined ? undefined : n18((expiredScaled * idx[0]) / RAY)
  const pot = n18(r<bigint>(17))
  const locked = lockedByTier.every((x) => x !== undefined)
    ? lockedByTier.reduce((a, b) => a! + b!, 0)!
    : undefined
  /** Everything not in the pool, the vault, the tax buffer or the keeper bond sits in wallets, unlocked. */
  const wallets =
    supply !== undefined && pool !== undefined && vaultBal !== undefined && taxPending !== undefined && bond !== undefined
      ? supply - pool - vaultBal - taxPending - bond
      : undefined
  const circulating = wallets !== undefined && locked !== undefined ? wallets + locked : undefined
  const lockedOfCirc = locked !== undefined && circulating ? (locked / circulating) * 100 : undefined
  const share = (x: number | undefined) => (x === undefined || !supply ? '—' : share100((x / supply) * 100))

  /* ---- melt per day, at today's rates ---- */
  const rUnl = rateBps === undefined ? undefined : rateBps / 10_000
  const rates = [5, 6, 7, 8].map((i) => {
    const b = r<bigint>(i)
    return b === undefined ? undefined : Number(b) / 10_000
  })
  const meltPerDay =
    rUnl !== undefined && wallets !== undefined && pool !== undefined && rates.every((x) => x !== undefined) &&
    lockedByTier.every((x) => x !== undefined) && expired !== undefined
      ? wallets * rUnl + expired * rUnl + pool * rates[0]! +
        lockedByTier.reduce((a, x, b) => a! + x! * rates[b + 1]!, 0)!
      : undefined

  /* ---- market ---- */
  const t0 = m<Address>(3)
  const res = m<readonly [bigint, bigint, number]>(4)
  const spyInPool =
    res && t0 && addresses.spy ? n18(t0.toLowerCase() === addresses.spy.toLowerCase() ? res[0] : res[1]) : undefined
  const liquidity = spyInPool !== undefined && prices.spy !== undefined ? 2 * spyInPool * prices.spy : undefined

  /* ---- agents & keeper ---- */
  const living = r<bigint>(18)
  const minted = r<bigint>(19) === undefined ? undefined : r<bigint>(19)! - 1n
  const attackers = m<bigint>(0)
  const settledThrough = r<number>(21)
  const bondOk = r<boolean>(23)
  const chainLeft = r<bigint>(24)
  const agentsPaused = r<boolean>(22)

  /* ---- reserve ---- */
  const resUsdg = m<bigint>(1)
  const resSpy = n18(m<bigint>(2))
  const reserveUsd =
    resUsdg !== undefined && resSpy !== undefined && prices.spy !== undefined
      ? Number(formatUnits(resUsdg, 6)) + resSpy * prices.spy
      : undefined

  const clock = secondsRemaining === undefined ? null : duration(secondsRemaining)

  return (
    <div className="stack">
      <MintStatus />
      <div className="grid">
        <Field title="Market">
          <dl>
            <Pair label="Price" value={price(px)} />
            <Pair label="Market cap" value={dollars(supply !== undefined && px !== undefined ? supply * px : undefined)} />
            <Pair label="Pool liquidity" value={dollars(liquidity)} />
            <Pair label="SPY / ETH" value={`${dollars(prices.spy)} / ${dollars(prices.eth)}`} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Spot prices from the Uniswap v2 pools (HIGHER/SPY, SPY/USDG, WETH/USDG). Market cap uses the
            current supply, which shrinks every 30 minutes.
          </p>
        </Field>

        <Field title="Melted so far">
          <dl>
            <Pair label="Launch supply" value={`${compact(launch)} HIGHER`} />
            <Pair label="Supply now" value={`${compact(supply)} HIGHER`} />
            <Pair
              label="Gone"
              value={
                <span className="loss">
                  {compact(melted)} ({launch && melted !== undefined ? pct((melted / launch) * 100, 2) : '—'})
                </span>
              }
            />
            <Pair label="Worth today" value={<span className="loss">{dollars(melted !== undefined && px !== undefined ? melted * px : undefined)}</span>} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Burned for good: wallet and pool melt, and the melt of expired locks. Lock melt is not in
            this figure — it moves to the audit pool instead.
          </p>
        </Field>

        <Field title="Melting now">
          <dl>
            <Pair label="Wallet rate" value={<span className="loss">{rateBps === undefined ? '—' : `${pct(bpsToPct(rateBps))} / day`}</span>} />
            <Pair label="Range" value={`${bpsToPct(MELT.minBps)}–${bpsToPct(MELT.maxBps)}% per day`} />
            <Pair label="Half-life (unlocked)" value={rateBps === undefined ? '—' : `${halfLifeDays(rateBps).toFixed(1)} days`} />
            <Pair label="Next 24 h, all holders" value={<span className="loss"><Amount v={meltPerDay} px={px} /></span>} />
            <Pair label="= of supply" value={meltPerDay !== undefined && supply ? pct((meltPerDay / supply) * 100, 2) : '—'} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Projection at today's rates: wallets at the full rate, the pool at half, locks at 0.3× / 0.2×
            / 0.1×. The rate falls as more is locked.
          </p>
        </Field>

        <Field title="Where the supply is">
          <dl>
            <Pair label={`In wallets (${share(wallets)})`} value={<Amount v={wallets} px={px} />} />
            <Pair label={`Uniswap pool (${share(pool)})`} value={<Amount v={pool} px={px} />} />
            <Pair label={<span className="protected">Locked ({share(locked)})</span>} value={<Amount v={locked} px={px} />} />
            <Pair label={`Audit pool (${share(pot)})`} value={<Amount v={pot} px={px} />} />
            <Pair label={`Tax, not yet sold (${share(taxPending)})`} value={<Amount v={taxPending} px={px} />} />
            <Pair label={`Keeper bond (${share(bond)})`} value={<Amount v={bond} px={px} />} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Locked is {lockedOfCirc === undefined ? '—' : share100(lockedOfCirc)} of the HIGHER held outside
            the pool — the share that sets the melt rate.
          </p>
        </Field>

        <Field title="Locked offshore">
          <dl>
            {TIERS.map((name, b) => (
              <Pair key={name} label={`${name} vaults`} value={<Amount v={lockedByTier[b]} px={px} />} />
            ))}
            <Pair label={<strong>Total locked</strong>} value={<span className="protected"><Amount v={locked} px={px} /></span>} />
            <Pair label="Expired, not withdrawn" value={<span className={expired ? 'loss' : undefined}><Amount v={expired} px={px} /></span>} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Expired positions melt at the full rate again and that melt is burned. Their owners should
            withdraw or relock.
          </p>
        </Field>

        <Field title="IRS agents" note={epoch !== undefined ? `epoch ${epoch}` : undefined}>
          <dl>
            <Pair label="Audit pool" value={<Amount v={pot} px={px} />} />
            <Pair label="Audits this epoch" value={attackers === undefined ? '—' : String(attackers)} />
            <Pair label="Epoch ends in" value={clock ?? '—'} />
            <Pair label="Agents alive / minted" value={living === undefined || minted === undefined ? '—' : `${living} / ${minted}`} />
            <Pair label="Status" value={agentsPaused === undefined ? '—' : agentsPaused ? <span className="loss">paused</span> : 'open'} />
          </dl>
        </Field>

        <Field title="Treasury">
          <dl>
            <Pair label="Reserve, USDG" value={resUsdg === undefined ? '—' : dollars(Number(formatUnits(resUsdg, 6)))} />
            <Pair label="Reserve, SPY" value={resSpy === undefined ? '—' : `${resSpy.toFixed(6)} SPY · ${dollars(prices.spy !== undefined ? resSpy * prices.spy : undefined)}`} />
            <Pair label={<strong>Reserve total</strong>} value={dollars(reserveUsd)} />
            <Pair label="Tax waiting to convert" value={<Amount v={taxPending} px={px} />} />
            <Pair label="Converts from" value={`${compact(n18(r<bigint>(26)))} HIGHER`} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Trading tax collects on the token and is sold for SPY into the reserve. Mint, feed and lock
            fees go to the same reserve in USDG.
          </p>
        </Field>

        <Field title="Keeper">
          <dl>
            <Pair label="Settled through epoch" value={settledThrough === undefined ? '—' : String(settledThrough - 1)} />
            <Pair label="Bond" value={bondOk === undefined ? '—' : bondOk ? <span className="protected">sufficient</span> : <span className="loss">too low — audits blocked</span>} />
            <Pair label="Randomness left" value={chainLeft === undefined ? '—' : `${chainLeft.toLocaleString()} epochs`} />
          </dl>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            The keeper reveals each epoch's random value and settles the audits. If it falls behind, its
            bond is slashed.
          </p>
        </Field>
      </div>
    </div>
  )
}
