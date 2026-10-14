import { useState } from 'react'
import { Field, Notice } from '../components/ui'
import { addresses } from '../config/addresses'
import { activeChain, explorerAddress } from '../config/chains'

type Row = { name: string; what: string; address: string | null }

/** Every contract a user or a bot might need, with the links that prove what it is. */
export function Contracts() {
  const [copied, setCopied] = useState<string | null>(null)
  const rows: Row[] = [
    { name: 'HIGHER token', what: 'The token. Paste this into Uniswap, a bot or your wallet.', address: addresses.higher },
    { name: 'Uniswap v2 pair', what: 'HIGHER/SPY pool — the only pool HIGHER trades in.', address: addresses.pair },
    { name: 'Cayman Islands', what: 'Lock vaults and the audit pool.', address: addresses.cayman },
    { name: 'IRS Agents', what: 'Agent NFTs, audits and payouts.', address: addresses.irsAgent },
    { name: 'Tax oracle', what: 'Works out the trading tax: buys 4%, sells 4–8%.', address: addresses.twapOracle },
    { name: 'Randomness', what: 'Pre-committed random values for the agents, and the keeper bond.', address: addresses.seed },
    { name: 'SPY', what: 'The token HIGHER is paired with.', address: addresses.spy },
    { name: 'Uniswap v2 router', what: 'Where trades and approvals go.', address: addresses.router },
  ]
  const copy = (a: string) => {
    void navigator.clipboard?.writeText(a).then(() => {
      setCopied(a)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  const pair = addresses.pair ?? ''
  const token = addresses.higher ?? ''
  return (
    <div className="stack">
      <Notice kind="calm">
        <p>
          All HIGHER contracts are source-verified on the {activeChain.name} explorer — open
          a link and choose the Contract tab to read the exact code that runs. Network:{' '}
          {activeChain.name}, chain ID {activeChain.id}.
        </p>
      </Notice>
      <Field title="Charts and trading">
        <p className="links">
          <a href={`https://dexscreener.com/search?q=${pair}`} target="_blank" rel="noreferrer">DexScreener</a>
          <a href={explorerAddress(token)} target="_blank" rel="noreferrer">Token on Blockscout</a>
          <a href={`${explorerAddress(token)}?tab=holders`} target="_blank" rel="noreferrer">Holders</a>
          <a href={`${explorerAddress(pair)}?tab=token_transfers`} target="_blank" rel="noreferrer">Pool trades</a>
        </p>
      </Field>
      <Field title="Contract addresses">
        <table className="tbl">
          <tbody>
            {rows.map((r) =>
              r.address ? (
                <tr key={r.name}>
                  <td style={{ verticalAlign: 'top', paddingRight: 10 }}>
                    <strong>{r.name}</strong>
                    <div className="muted">{r.what}</div>
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <div className="addr">{r.address}</div>
                    <div className="links" style={{ marginTop: 4 }}>
                      <a href={explorerAddress(r.address)} target="_blank" rel="noreferrer">Blockscout</a>
                      <a href={`${explorerAddress(r.address)}?tab=contract`} target="_blank" rel="noreferrer">Source</a>
                      <button className="btn" style={{ minWidth: 0, padding: '1px 8px' }} onClick={() => copy(r.address!)}>
                        {copied === r.address ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </Field>
    </div>
  )
}
