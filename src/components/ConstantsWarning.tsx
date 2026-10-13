import { Notice } from './ui'
import { useProtocolConstants } from '../hooks/useProtocolConstants'

/**
 * Shown when a value read from a contract disagrees with the value this build
 * expects. Deliberately not silent: the screens quote odds and prices at
 * people, and a stale constant renders a confident wrong number on the page
 * whose entire job is to be accurate about what they're risking.
 *
 * Renders nothing in the normal case, so it costs the user nothing.
 */
export function ConstantsWarning() {
  const { mismatches } = useProtocolConstants()
  if (mismatches.length === 0) return null

  return (
    <Notice kind="warn">
      <p>
        Some contract values differ from what this build expects. The figures
        shown are the ones read from the contract, which are the ones that
        apply. This list is a bug report, not something you need to act on:
      </p>
      <ul>
        {mismatches.map((m) => (
          <li key={m.label}>
            {m.label}: contract says{' '}
            <span className="figure-sm">{m.onChain}</span>, this build expected{' '}
            <span className="figure-sm">{m.expected}</span>
          </li>
        ))}
      </ul>
    </Notice>
  )
}
