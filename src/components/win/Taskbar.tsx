import { useEffect, useState } from 'react'
import { MeltIcon, StartIcon } from './Icons'
import { useMeltingBalance } from '../../hooks/useHigher'
import { bpsToPct } from '../../lib/melt'
import { num, pct } from '../../lib/format'
import type { WindowChrome } from './Win'

/**
 * The taskbar, and the reason this whole metaphor works.
 *
 * The brief requires the melt to be visible at all times. In a windowed UI
 * that's a problem — close the window and the number is gone. The system tray
 * solves it exactly the way a real OS solves it for the clock: it is chrome,
 * not content. There is no control here that hides it.
 */
export function Taskbar({
  windows,
  activeId,
  onTaskClick,
  onStart,
}: {
  windows: WindowChrome[]
  activeId: string | null
  onTaskClick: (id: string) => void
  onStart: () => void
}) {
  const { live, rateBps } = useMeltingBalance()
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="taskbar raised">
      <button className="start" onClick={onStart}>
        <StartIcon size={20} />
        Start
      </button>

      <div className="tasks">
        {windows.map((w) => (
          <button
            key={w.id}
            className="task"
            data-active={activeId === w.id && !w.minimised}
            onClick={() => onTaskClick(w.id)}
          >
            {w.icon}
            <span>{w.title}</span>
          </button>
        ))}
      </div>

      <div className="tray" title="Your HIGHER balance and today's melt rate">
        <MeltIcon size={20} />
        <span className="tray-melt">
          {live === undefined ? '—' : num(live, 2)}
          {rateBps !== undefined ? ` ▼${pct(bpsToPct(rateBps), 1)}` : ''}
        </span>
        <span className="tray-clock">
          {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
