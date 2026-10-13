import type { TxState } from '../hooks/useTx'
import { explorerTx } from '../config/chains'
import { Notice } from './ui'

/** One line of feedback for the last write on a screen. Renders nothing while idle. */
export function TxLine({ state, onDismiss }: { state: TxState; onDismiss?: () => void }) {
  if (state.status === 'idle') return null
  const link = state.hash ? (
    <>
      {' '}
      <a href={explorerTx(state.hash)} target="_blank" rel="noreferrer">
        view tx
      </a>
    </>
  ) : null
  const close = onDismiss ? (
    <button
      className="btn secondary"
      style={{ padding: '0 0.375rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}
      onClick={onDismiss}
    >
      Dismiss
    </button>
  ) : null

  if (state.status === 'approving' || state.status === 'sending')
    return (
      <Notice kind="calm">
        <p>
          {state.label}: {state.hash ? 'waiting for confirmation…' : 'confirm in your wallet…'}
          {link}
        </p>
      </Notice>
    )
  if (state.status === 'success')
    return (
      <Notice kind="calm">
        <p>
          <span className="protected">{state.label}: confirmed.</span>
          {link}
          {close}
        </p>
      </Notice>
    )
  return (
    <Notice kind="warn">
      <p>
        <span className="loss">{state.label} failed:</span> {state.error}
        {link}
        {close}
      </p>
    </Notice>
  )
}
