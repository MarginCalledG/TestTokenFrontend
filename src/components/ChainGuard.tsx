import { useAccount, useSwitchChain } from 'wagmi'
import { activeChain } from '../config/chains'

/**
 * Fixed banner whenever the connected wallet is on another chain. Phantom, for one, answers on
 * Ethereum unless Robinhood Chain is enabled and selected — and would then sign approvals there.
 */
export function ChainGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending, error } = useSwitchChain()
  if (!isConnected || chainId === activeChain.id) return null
  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
        maxWidth: 'min(640px, calc(100vw - 32px))', background: '#fff3c4', color: '#222',
        border: '2px solid #222', padding: '10px 12px', fontSize: 14, boxShadow: '3px 3px 0 #222',
      }}
    >
      <strong>Wrong network.</strong> Your wallet is on chain {chainId ?? '?'}, this app only works on{' '}
      {activeChain.name} ({activeChain.id}). Nothing will be sent until you switch.{' '}
      <button className="btn" disabled={isPending} onClick={() => switchChain({ chainId: activeChain.id })}>
        {isPending ? 'Switching…' : `Switch to ${activeChain.name}`}
      </button>
      {error ? (
        <div style={{ marginTop: 6, fontSize: 13 }}>
          Your wallet refused to switch. Phantom: Settings → Active Networks → enable Robinhood Chain,
          then pick it for this site — or use MetaMask / Rabby.
        </div>
      ) : null}
    </div>
  )
}
