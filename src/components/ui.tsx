import type { ReactNode } from 'react'
import { missing, type ContractKey } from '../config/addresses'

export function Field({
  title,
  note,
  children,
}: {
  title: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="field">
      <div className="field-head">
        <h2>{title}</h2>
        {note ? <span className="field-note">{note}</span> : null}
      </div>
      <div className="field-body">{children}</div>
    </section>
  )
}

export function Pair({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="pair">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function Notice({
  kind = 'calm',
  children,
}: {
  kind?: 'calm' | 'warn' | 'setup'
  children: ReactNode
}) {
  return <div className={`notice ${kind}`}>{children}</div>
}

/**
 * Shown instead of data when the relevant contract has no address yet.
 *
 * Deliberately not a skeleton loader or a row of zeros: before deployment
 * there is no number, and rendering 0.00 would be indistinguishable from a
 * real empty balance.
 */
export function NotConfigured({ needs }: { needs: ContractKey[] }) {
  const gaps = missing(...needs)
  return (
    <Notice kind="setup">
      <p>
        Not wired up yet. These contracts have no address in the current
        environment: <span className="figure-sm">{gaps.join(', ')}</span>.
      </p>
      <p className="muted">
        Set them in <span className="figure-sm">.env</span> after the testnet
        deploy — nothing else needs to change.
      </p>
    </Notice>
  )
}

export function Gate({
  needs,
  children,
}: {
  needs: ContractKey[]
  children: ReactNode
}) {
  if (missing(...needs).length > 0) return <NotConfigured needs={needs} />
  return <>{children}</>
}
