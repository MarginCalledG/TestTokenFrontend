import { formatEther, formatUnits } from 'viem'
import { useAccount, useBalance, useConnect, useDisconnect, useReadContract } from 'wagmi'
import { erc20Abi } from '../abi'
import { addresses } from '../config/addresses'
import { usd, useUsdPrices } from '../hooks/useUsdPrices'
import { Field, Notice, Pair } from '../components/ui'
import { useMeltingBalance } from '../hooks/useHigher'
import { useLockPositions } from '../hooks/useCayman'

import { halfLifeDays, meltOver } from '../lib/melt'
import { num, short, token } from '../lib/format'
import { activeChain, explorerAddress, FAUCET_URL, isTestnet } from '../config/chains'
import { DEMO, demo } from '../config/demo'
import { MeltStrip } from '../components/MeltStrip'

export function Home({ go }: { go: (screen: string) => void }) {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { live, decimals, rateBps } = useMeltingBalance()
  const { positions } = useLockPositions()

  const shown = isConnected || DEMO
  const shownAddress = address ?? (DEMO ? demo.account : undefined)
  const wrongChain = isConnected && chainId !== activeChain.id
  const protectedTotal = positions.reduce((sum, p) => sum + p.amount, 0n)
  const lockedNum = Number(formatUnits(protectedTotal, decimals))
  const prices = useUsdPrices()
  const px = prices.higher
  const { data: ethBal } = useBalance({ address, query: { enabled: !!address, refetchInterval: 15_000 } })
  const { data: usdgBal } = useReadContract({
    address: addresses.usdg ?? undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addresses.usdg, refetchInterval: 15_000 },
  })

  if (!shown) {
    return (
      <div className="stack">
        <Field title="Connect a wallet">
          <p>
            HIGHER lives on {activeChain.name}. Connect a wallet on that network
            to see your balance and use the protocol.
          </p>
          <div className="btn-row">
            {connectors.map((c) => (
              <button
                key={c.uid}
                className="btn"
                onClick={() => connect({ connector: c })}
                disabled={isPending}
              >
                {isPending ? 'Connecting…' : `Connect ${c.name}`}
              </button>
            ))}
          </div>
          {isTestnet ? (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Testnet. Get gas from the{' '}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer">
                faucet
              </a>
              .
            </p>
          ) : null}
        </Field>

        <Field title="Before you connect">
          <p>
            HIGHER shrinks. Every wallet's balance falls continuously, between
            4.2% and 6.9% per day, whether or not you do anything. Locking it in
            the Cayman Islands slows that, and the IRS Agents compete for what
            locked positions still lose.
          </p>
          <button className="btn secondary" onClick={() => go('how')}>
            Read how this works
          </button>
        </Field>
      </div>
    )
  }

  return (
    <div className="stack">
      <MeltStrip />
      {wrongChain ? (
        <Notice kind="warn">
          <p>
            This wallet is on chain {chainId}. Switch to {activeChain.name}{' '}
            (chain {activeChain.id}) — nothing on this page is accurate until
            you do.
          </p>
        </Notice>
      ) : null}

      <div className="grid">
        <Field
          title="Wallet"
          note={
            <a
              href={explorerAddress(shownAddress!)}
              target="_blank"
              rel="noreferrer"
            >
              {short(shownAddress)}
            </a>
          }
        >
          <dl>
            <Pair label="Network" value={activeChain.name} />
            <Pair
              label="Unlocked HIGHER"
              value={<>{live === undefined ? '—' : num(live, 4)} <Usd v={live === undefined ? undefined : live * (px ?? NaN)} /></>}
            />
            <Pair
              label="Locked offshore"
              value={<>{token(protectedTotal, decimals)} <Usd v={lockedNum * (px ?? NaN)} /></>}
            />
            <Pair
              label={<strong>Total value</strong>}
              value={<strong>{live === undefined || px === undefined ? '—' : usd((live + lockedNum) * px).replace('≈ ', '')}</strong>}
            />
            <Pair
              label="ETH"
              value={<>{ethBal === undefined ? '—' : num(Number(formatEther(ethBal.value)), 4)} <Usd v={ethBal === undefined || prices.eth === undefined ? undefined : Number(formatEther(ethBal.value)) * prices.eth} /></>}
            />
            <Pair label="USDG" value={usdgBal === undefined ? '—' : `$${num(Number(formatUnits(usdgBal as bigint, 6)), 2)}`} />
          </dl>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        </Field>

        <Field title="What the melt costs you" note="at today's rate">
          {live === undefined || rateBps === undefined ? (
            <p className="muted">Reading your balance…</p>
          ) : (
            <>
              <dl>
                <Pair
                  label="Next hour"
                  value={
                    <span className="loss">
                      −{num(meltOver(live, 3600, rateBps), 4)}{' '}
                      <Usd v={px === undefined ? undefined : meltOver(live, 3600, rateBps) * px} />
                    </span>
                  }
                />
                <Pair
                  label="Next day"
                  value={
                    <span className="loss">
                      −{num(meltOver(live, 86_400, rateBps), 4)}{' '}
                      <Usd v={px === undefined ? undefined : meltOver(live, 86_400, rateBps) * px} />
                    </span>
                  }
                />
                <Pair
                  label="Next week"
                  value={
                    <span className="loss">
                      −{num(meltOver(live, 7 * 86_400, rateBps), 4)}{' '}
                      <Usd v={px === undefined ? undefined : meltOver(live, 7 * 86_400, rateBps) * px} />
                    </span>
                  }
                />
                <Pair
                  label="Half of it gone in"
                  value={`${halfLifeDays(rateBps).toFixed(1)} days`}
                />
              </dl>
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                These are projections at the current rate. The rate moves with
                how much of the supply is locked, so the real figures will
                differ.
              </p>
            </>
          )}
        </Field>
      </div>

      <Field title="What you can do about it">
        <p>
          A 14-day lock cuts the melt to a tenth while it is active. Shorter
          locks slow it. Everything has a fee, and every fee is shown before you
          confirm.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => go('cayman')}>
            Lock HIGHER
          </button>
          <button className="btn secondary" onClick={() => go('trade')}>
            Trade
          </button>
          <button className="btn secondary" onClick={() => go('agents')}>
            IRS Agents
          </button>
          <button className="btn secondary" onClick={() => go('how')}>
            How this works
          </button>
        </div>
      </Field>
    </div>
  )
}

/** Grey "(≈ $x)" after an amount. */
function Usd({ v }: { v: number | undefined }) {
  const t = usd(v)
  return t ? <span className="muted">({t})</span> : null
}
