import { useCallback, useEffect, useRef, useState } from 'react'

export type WindowChrome = {
  id: string
  title: string
  icon: React.ReactNode
  x: number
  y: number
  w: number
  h: number
  z: number
  minimised: boolean
  maximised: boolean
}

/**
 * A window. Draggable by its title bar on pointer devices; on narrow screens
 * it ignores its own geometry and fills the desktop, because dragging
 * overlapping windows around a 380px viewport is unusable and the taskbar
 * already provides the switching.
 *
 * Dragging is pointer-events based so it works with mouse, pen and touch
 * without three code paths, and it captures the pointer so a fast drag that
 * outruns the cursor doesn't drop the window mid-move.
 */
export function Win({
  chrome,
  active,
  narrow,
  onFocus,
  onClose,
  onMinimise,
  onToggleMax,
  onMove,
  status,
  children,
}: {
  chrome: WindowChrome
  active: boolean
  narrow: boolean
  onFocus: () => void
  onClose: () => void
  onMinimise: () => void
  onToggleMax: () => void
  onMove: (x: number, y: number) => void
  status?: React.ReactNode
  children: React.ReactNode
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const fill = narrow || chrome.maximised

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      onFocus()
      if (fill) return
      if ((e.target as HTMLElement).closest('.tbtn')) return
      drag.current = { dx: e.clientX - chrome.x, dy: e.clientY - chrome.y }
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [chrome.x, chrome.y, fill, onFocus],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return
      const x = e.clientX - drag.current.dx
      const y = e.clientY - drag.current.dy
      // Keep the title bar reachable: never let it go above the desktop or
      // fully off either edge, or the window becomes unrecoverable.
      onMove(
        Math.min(Math.max(x, -chrome.w + 90), window.innerWidth - 60),
        Math.min(Math.max(y, 0), window.innerHeight - 60),
      )
    },
    [chrome.w, onMove],
  )

  const endDrag = useCallback(() => {
    drag.current = null
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const stop = () => endDrag()
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [dragging, endDrag])

  if (chrome.minimised) return null

  const style: React.CSSProperties = fill
    ? { inset: 0, width: 'auto', height: 'auto', zIndex: chrome.z }
    : {
        left: chrome.x,
        top: chrome.y,
        width: chrome.w,
        height: chrome.h,
        zIndex: chrome.z,
      }

  return (
    <div
      className="window raised"
      data-active={active}
      style={style}
      onPointerDown={onFocus}
      role="dialog"
      aria-label={chrome.title}
    >
      <div
        className="titlebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onDoubleClick={onToggleMax}
      >
        {chrome.icon}
        <span className="titlebar-text">{chrome.title}</span>
        <span className="titlebar-btns">
          <button className="tbtn" onClick={onMinimise} aria-label="Minimise">
            _
          </button>
          {!narrow ? (
            <button
              className="tbtn"
              onClick={onToggleMax}
              aria-label={chrome.maximised ? 'Restore' : 'Maximise'}
            >
              {chrome.maximised ? '❐' : '☐'}
            </button>
          ) : null}
          <button className="tbtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </span>
      </div>

      <div className="menubar">
        <button type="button">File</button>
        <button type="button">Edit</button>
        <button type="button">View</button>
        <button type="button">Help</button>
      </div>

      <div className="window-body sunken">{children}</div>

      {status ? <div className="statusbar">{status}</div> : null}
    </div>
  )
}
