import { useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { erc20Abi } from '../abi'
import { addresses } from '../config/addresses'
import { Field, Gate, Notice, Pair } from '../components/ui'
import { useMeltingBalance, useHigherStats } from '../hooks/useHigher'
import { applyMaxSellMargin, useTrade, type Asset, type Side } from '../hooks/useTrade'
import { usd, useUsdPrices } from '../hooks/useUsdPrices'
import { num, pct, token } from '../lib/format'
import { bpsToPct } from '../lib/melt'

const SLIPPAGE_OPTIONS = [50, 100, 300] as const

export function Trade() {
  const [side, setSide] = useState<Side>('buy')
  const [amountStr, setAmountStr] = useState('')
  const [slippageBps, setSlippageBps] = useState<number>(100)
  /** Most buyers hold ETH, not SPY — so ETH is the default. */
  const [asset, setAsset] = useState<Asset>('ETH')
  const prices = useUsdPrices()
  const { address: account } = useAccount()
  const { decimals, onChain: higherBalance } = useMeltingBalance()
  const { inLaunchWindow, maxWallet } = useHigherStats()

  // SPY is the input on a buy; the mock is 18 decimals but read it anyway.
  const { data: spyDecimalsRaw } = useReadContract({
    address: addresses.spy ?? undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: !!addresses.spy },
  })
  const spyDecimals = spyDecimalsRaw === undefined ? 18 : Number(spyDecimalsRaw)
  const assetDecimals = asset === 'USDG' ? 6 : asset === 'ETH' ? 18 : spyDecimals

  const inDecimals = side === 'buy' ? assetDecimals : decimals
  const outDecimals = side === 'buy' ? decimals : assetDecimals
  const inSymbol = side === 'buy' ? asset : 'HIGHER'
  const outSymbol = side === 'buy' ? 'HIGHER' : asset

  /** USD per whole unit of each side, for the "≈ $" labels. */
  const assetUsd = asset === 'ETH' ? prices.eth : asset === 'USDG' ? 1 : prices.spy
  const inUsd = side === 'buy' ? assetUsd : prices.higher
  const outUsd = side === 'buy' ? prices.higher : assetUsd
  const toUsd = (v: bigint | undefined, d: number, px: number | undefined) =>
    v === undefined || px === undefined ? undefined : Number(formatUnits(v, d)) * px

  const { data: ethBal } = useBalance({ address: account, query: { enabled: !!account, refetchInterval: 15_000 } })
  const assetToken = asset === 'SPY' ? addresses.spy : asset === 'USDG' ? addresses.usdg : null
  const { data: tokenBal } = useReadContract({
    address: assetToken ?? undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!assetToken && !!account, refetchInterval: 15_000 },
  })
  const assetBalance = asset === 'ETH' ? ethBal?.value : (tokenBal as bigint | undefined)

  let amount: bigint | undefined
  try {
    amount = amountStr ? parseUnits(amountStr, inDecimals) : undefined
  } catch {
    amount = undefined
  }

  const t = useTrade(side, amount, slippageBps, asset)
  const tooMuch = side === 'buy' && amount !== undefined && assetBalance !== undefined && amount > assetBalance
  const { quote } = t

  /**
   * What the route itself costs in $: value in − tax − value out, all at spot. This is the 0.3% per
   * pool plus price impact; the ETH route crosses three pools (one of them small), so show it.
   */
  const payUsd = amount !== undefined ? toUsd(amount, inDecimals, inUsd) : undefined
  const taxUsd = quote ? toUsd(quote.taxAmount, decimals, prices.higher) : undefined
  const outUsdV = quote ? toUsd(quote.expected, outDecimals, outUsd) : undefined
  const routeCost =
    payUsd !== undefined && taxUsd !== undefined && outUsdV !== undefined && payUsd - taxUsd - outUsdV > 0
      ? payUsd - taxUsd - outUsdV
      : undefined

  const setMaxSell = () => {
    if (higherBalance === undefined) return
    setAmountStr(formatUnits(applyMaxSellMargin(higherBalance), decimals))
  }

  return (
    <div className="stack">
      {t.inLaunchWindow ? (
        <Notice kind="warn">
          <p>
            Launch window is active. Tax is a flat {bpsToPct(t.taxCapBps)}% in
            both directions — the oracle is bypassed — and a cumulative
            per-wallet cap applies to buys.
          </p>
        </Notice>
      ) : null}

      <Gate needs={['higher', 'spy', 'router', 'pair', 'twapOracle']}>
        <Notice kind="calm">
          <p>
            Wallet-to-wallet transfers of HIGHER are never taxed. The tax below
            applies only to trades against the pool.
          </p>
        </Notice>
      </Gate>

      <div className="grid">
        <Field title={side === 'buy' ? `Buy HIGHER with ${asset}` : `Sell HIGHER for ${asset}`}>
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 10 }}>
            <button
              className="btn"
              disabled={side === 'buy'}
              onClick={() => {
                setSide('buy')
                setAmountStr('')
              }}
            >
              Buy
            </button>
            <button
              className="btn"
              disabled={side === 'sell'}
              onClick={() => {
                setSide('sell')
                setAmountStr('')
              }}
            >
              Sell
            </button>
          </div>

          <label>{side === 'buy' ? 'Pay with' : 'Receive'}</label>
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 10 }}>
            {(['ETH', 'USDG', 'SPY'] as const).map((a) => (
              <button
                key={a}
                className="btn"
                style={{ minWidth: 0 }}
                disabled={asset === a}
                onClick={() => {
                  setAsset(a)
                  if (side === 'buy') setAmountStr('')
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <label htmlFor="amt">Amount of {inSymbol}</label>
          <input
            id="amt"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
          {amount !== undefined && amount > 0n ? (
            <p className="muted" style={{ marginTop: 4 }}>
              {usd(toUsd(amount, inDecimals, inUsd))}
            </p>
          ) : null}

          {side === 'buy' && assetBalance !== undefined ? (
            <p className={tooMuch ? 'muted loss' : 'muted'} style={{ marginTop: 6 }}>
              You hold {token(assetBalance, assetDecimals)} {asset}{' '}
              {usd(toUsd(assetBalance, assetDecimals, assetUsd))}
              {tooMuch ? ' — not enough for this amount.' : ''}
              {asset === 'ETH' && !tooMuch ? ' Keep a little ETH for gas.' : ''}
            </p>
          ) : null}

          {side === 'sell' && higherBalance !== undefined ? (
            <p className="muted" style={{ marginTop: 6 }}>
              You hold {token(higherBalance, decimals)} HIGHER{' '}
              {usd(toUsd(higherBalance, decimals, prices.higher))}.{' '}
              <button className="btn" style={{ minWidth: 0 }} onClick={setMaxSell}>
                Max
              </button>{' '}
              leaves 0.5% behind on purpose: the balance melts in 30-minute
              steps and the token reverts rather than clamping, so selling the
              exact displayed figure fails if the transaction lands after a
              step.
            </p>
          ) : null}

          <div className="btn-row">
            {t.needsApproval ? (
              <button
                className="btn"
                disabled={!t.ready || !amount || t.status === 'approving'}
                onClick={t.approve}
              >
                {t.status === 'approving' ? 'Approving…' : `Approve ${inSymbol}`}
              </button>
            ) : (
              <button
                className="btn"
                disabled={
                  !t.ready ||
                  !quote ||
                  !account ||
                  t.exceedsCap ||
                  tooMuch ||
                  t.status === 'swapping'
                }
                onClick={t.swap}
              >
                {t.status === 'swapping'
                  ? 'Swapping…'
                  : side === 'buy'
                    ? 'Buy HIGHER'
                    : 'Sell HIGHER'}
              </button>
            )}
          </div>

          {t.status === 'success' ? (
            <p className="muted protected" style={{ marginTop: 6 }}>
              Done. Balances update on the next block.
            </p>
          ) : null}
          {t.error ? (
            <p className="muted loss" style={{ marginTop: 6 }}>
              {t.error.split('\n')[0]}
            </p>
          ) : null}
        </Field>

        <Field
          title="Before you sign"
          note={t.stale ? 'updating…' : t.quoting ? 'quoting…' : undefined}
        >
          {amount === undefined ? (
            <p className="muted">
              Enter an amount. The tax depends on trade size and direction, so
              there is no single number to quote in advance.
            </p>
          ) : quote === undefined ? (
            <p className="muted">Fetching a quote…</p>
          ) : (
            <>
              <dl>
                <Pair
                  label="You pay"
                  value={<>{num(Number(formatUnits(amount, inDecimals)), 4)} {inSymbol} <Usd v={toUsd(amount, inDecimals, inUsd)} /></>}
                />
                <Pair
                  label={`Tax (${pct(bpsToPct(quote.taxBps))})`}
                  value={
                    <span className="loss">
                      −{num(Number(formatUnits(quote.taxAmount, decimals)), 4)} HIGHER{' '}
                      <Usd v={toUsd(quote.taxAmount, decimals, prices.higher)} />
                    </span>
                  }
                />
                {routeCost !== undefined ? (
                  <Pair
                    label={`Pool fees & price impact (${t.hops} pool${t.hops > 1 ? 's' : ''})`}
                    value={<span className="muted">{usd(routeCost)}</span>}
                  />
                ) : null}
                <Pair
                  label="Expected"
                  value={<>{num(Number(formatUnits(quote.expected, outDecimals)), 4)} {outSymbol} <Usd v={toUsd(quote.expected, outDecimals, outUsd)} /></>}
                />
                <Pair
                  label="At least"
                  value={<>{num(Number(formatUnits(quote.minOut, outDecimals)), 4)} {outSymbol} <Usd v={toUsd(quote.minOut, outDecimals, outUsd)} /></>}
                />
              </dl>

              <label htmlFor="slip" style={{ marginTop: 10 }}>
                Slippage tolerance
              </label>
              <div className="btn-row" style={{ marginTop: 0 }}>
                {SLIPPAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    className="btn"
                    style={{ minWidth: 0 }}
                    disabled={slippageBps === s}
                    onClick={() => setSlippageBps(s)}
                  >
                    {bpsToPct(s)}%
                  </button>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                Covers price movement only. The tax is a known cost and is
                already subtracted above, not hidden in this tolerance.
              </p>
            </>
          )}

          {t.capRemaining !== undefined ? (
            <p className={t.exceedsCap ? 'muted loss' : 'muted'} style={{ marginTop: 8 }}>
              Launch-hour wallet cap: {token(t.capRemaining, decimals, 0)} HIGHER
              left for this address
              {maxWallet !== undefined
                ? ` of ${token(maxWallet, decimals, 0)}`
                : ''}
              . The cap is cumulative across all your buys and cannot be reset
              by sending tokens elsewhere.
              {t.exceedsCap ? ' This trade would exceed it and would revert.' : ''}
            </p>
          ) : null}
        </Field>
      </div>

      <Notice kind="calm">
        <p>
          HIGHER sits directly in a Uniswap V2 pair against SPY, and the tax
          lives in the token itself, which is why the router's own quote has to
          be corrected for it before you see a number. Paying with ETH routes
          ETH → USDG → SPY → HIGHER through three pools in one transaction
          (no approval needed), USDG routes USDG → SPY → HIGHER through two;
          each pool takes 0.3%. Selling is the same route backwards, and SPY
          is the cheapest (one pool). Dollar values are spot prices from those
          pools.
        </p>
        <p className="muted">
          On a buy the pair sends the full amount and the token taxes it on the
          way to you. On a sell the tax comes off on the way into the pool, so
          the pool receives less than you send. Same rate, different side.
          {inLaunchWindow ? '' : ' Tax is capped at 8%.'}
        </p>
      </Notice>
    </div>
  )
}

/** Small grey "≈ $x" after a token amount. */
function Usd({ v }: { v: number | undefined }) {
  const text = usd(v)
  return text ? <span className="muted">({text})</span> : null
}
