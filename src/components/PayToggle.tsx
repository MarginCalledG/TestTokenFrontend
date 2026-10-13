import type { PayWith } from '../hooks/useEthPay'

/** "Pay with ETH | USDG". Hidden when the contract has no ETH payment. */
export function PayToggle({
  supported,
  value,
  onChange,
}: {
  supported: boolean
  value: PayWith
  onChange: (v: PayWith) => void
}) {
  if (!supported) return null
  return (
    <div className="btn-row" style={{ alignItems: 'center', gap: '0.375rem' }}>
      <span className="muted">Pay with</span>
      <button className={value === 'eth' ? 'btn' : 'btn secondary'} onClick={() => onChange('eth')}>
        ETH
      </button>
      <button className={value === 'usdg' ? 'btn' : 'btn secondary'} onClick={() => onChange('usdg')}>
        USDG
      </button>
    </div>
  )
}
