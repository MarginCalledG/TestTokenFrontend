import { formatUnits } from 'viem'

/** Fixed decimals, grouped, no locale surprises. Used for all token figures. */
export function num(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function token(value: bigint | undefined, decimals: number, show = 4): string {
  if (value === undefined) return '—'
  return num(Number(formatUnits(value, decimals)), show)
}

export function usdg(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function pct(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

/** Countdown as 2d 04:31:09. Negative values return null so callers can
 *  branch on "expired" rather than rendering a negative clock. */
export function duration(seconds: number): string | null {
  if (seconds <= 0) return null
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const clock = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
  return d > 0 ? `${d}d ${clock}` : clock
}

/** How long ago, for "expired 3h ago". */
export function ago(seconds: number): string {
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return `${Math.floor(abs / 60)}m ago`
  if (abs < 86_400) return `${Math.floor(abs / 3600)}h ago`
  return `${Math.floor(abs / 86_400)}d ago`
}

export function short(address: string | undefined): string {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
