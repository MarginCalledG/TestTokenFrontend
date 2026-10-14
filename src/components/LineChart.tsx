/**
 * Small line chart in the window style: one series, pixel-crisp frame, min/max on the left,
 * first and last date underneath, the latest value called out. No library — the data is a few
 * hundred points and the look has to match the rest of the desktop.
 */
export function LineChart({
  points,
  format,
  color = '#000080',
  height = 140,
  empty = 'No data yet.',
}: {
  points: [number, number][]
  format: (v: number) => string
  color?: string
  height?: number
  empty?: string
}) {
  const pts = points.filter(([, v]) => Number.isFinite(v))
  if (pts.length < 2) return <p className="muted">{empty}</p>
  const W = 600
  const H = height
  const L = 4
  const R = 4
  const top = 8
  const bot = 8
  const t0 = pts[0][0]
  const t1 = pts[pts.length - 1][0]
  const minV = Math.min(...pts.map((p) => p[1]))
  const maxV = Math.max(...pts.map((p) => p[1]))
  // drawing range only: a flat series gets a little headroom, the labels keep the real values
  let lo = minV
  let hi = maxV
  if (hi === lo) {
    hi += Math.abs(hi) * 0.01 || 1
    lo -= Math.abs(lo) * 0.01 || 1
  }
  const x = (t: number) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R)
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bot)
  const d = pts.map(([t, v], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const last = pts[pts.length - 1]
  const date = (t: number) =>
    new Date(t * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="muted">
        <span>high {format(maxV)}</span>
        <span>
          now <strong style={{ color: 'var(--ink)' }}>{format(last[1])}</strong>
        </span>
      </div>
      <div className="sunken" style={{ background: '#fff', padding: 2 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="chart">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={top + f * (H - top - bot)} y2={top + f * (H - top - bot)} stroke="#e0e0e0" />
          ))}
          <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <circle cx={x(last[0])} cy={y(last[1])} r={3} fill={color} />
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="muted">
        <span>
          {date(t0)} · low {format(minV)}
        </span>
        <span>{date(t1)}</span>
      </div>
    </div>
  )
}
