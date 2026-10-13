import { useCallback, useEffect, useState } from 'react'
import { Win, type WindowChrome } from './components/win/Win'
import { Taskbar } from './components/win/Taskbar'
import {
  AgentIcon,
  HelpIcon,
  IslandIcon,
  MonitorIcon,
  TradeIcon,
  WalletIcon,
} from './components/win/Icons'
import { FolderIcon, ShortcutIcon } from './components/win/Pets'
import { Documents } from './screens/Documents'
import { Home } from './screens/Home'
import { Trade } from './screens/Trade'
import { Cayman } from './screens/Cayman'
import { Agents } from './screens/Agents'
import { Dashboard } from './screens/Dashboard'
import { HowItWorks } from './screens/HowItWorks'
import { activeChain, isTestnet } from './config/chains'
import { missing } from './config/addresses'
import { DEMO } from './config/demo'

type AppDef = {
  id: string
  title: string
  label: string
  icon: (p: { size?: number }) => JSX.Element
  w: number
  h: number
  /** Present on shortcuts: opens a URL in a new tab instead of a window. */
  href?: string
}

/** Window titles read like 90s software, deliberately. */
const APPS: AppDef[] = [
  { id: 'home', title: 'My Wallet', label: 'My Wallet', icon: WalletIcon, w: 620, h: 470 },
  { id: 'cayman', title: 'Cayman Islands', label: 'Cayman Islands', icon: IslandIcon, w: 760, h: 520 },
  { id: 'agents', title: 'IRS Agents', label: 'IRS Agents', icon: AgentIcon, w: 820, h: 560 },
  { id: 'trade', title: 'Trade', label: 'Trade', icon: TradeIcon, w: 660, h: 460 },
  { id: 'dashboard', title: 'Dashboard', label: 'Dashboard', icon: MonitorIcon, w: 700, h: 440 },
  { id: 'how', title: 'Read me first', label: 'Read me first', icon: HelpIcon, w: 640, h: 520 },
  {
    id: 'docs',
    title: 'Super important documents',
    label: 'Super important documents',
    icon: FolderIcon,
    w: 560,
    h: 420,
  },
  {
    id: 'pump',
    title: 'porn',
    label: 'porn',
    icon: ShortcutIcon,
    w: 0,
    h: 0,
    href: 'https://pump.fun',
  },
]

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 760,
  )
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 760)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return narrow
}

export default function App() {
  const narrow = useNarrow()
  const [windows, setWindows] = useState<WindowChrome[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [topZ, setTopZ] = useState(10)
  const [selected, setSelected] = useState<string | null>(null)
  const unset = missing('higher', 'cayman', 'irsAgent', 'twapOracle')

  const open = useCallback(
    (id: string) => {
      const def = APPS.find((a) => a.id === id)
      if (!def) return
      // Shortcuts leave the app. noopener/noreferrer because this is a wallet
      // UI and the destination should get no handle back to this window.
      if (def.href) {
        window.open(def.href, '_blank', 'noopener,noreferrer')
        return
      }
      setTopZ((z) => z + 1)
      setActiveId(id)
      setWindows((ws) => {
        const existing = ws.find((w) => w.id === id)
        if (existing) {
          return ws.map((w) =>
            w.id === id ? { ...w, minimised: false, z: topZ + 1 } : w,
          )
        }
        // Cascade so a second window doesn't land exactly on the first.
        const n = ws.length
        return [
          ...ws,
          {
            id,
            title: def.title,
            icon: <def.icon size={16} />,
            x: 40 + n * 28,
            y: 30 + n * 26,
            w: def.w,
            h: def.h,
            z: topZ + 1,
            minimised: false,
            maximised: false,
          },
        ]
      })
    },
    [topZ],
  )

  const focus = useCallback(
    (id: string) => {
      setTopZ((z) => z + 1)
      setActiveId(id)
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)))
    },
    [topZ],
  )

  const close = (id: string) =>
    setWindows((ws) => ws.filter((w) => w.id !== id))

  const patch = (id: string, p: Partial<WindowChrome>) =>
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)))

  const onTask = (id: string) => {
    const w = windows.find((x) => x.id === id)
    if (!w) return
    if (w.minimised) return open(id)
    if (activeId === id) return patch(id, { minimised: true })
    focus(id)
  }

  const body = (id: string) => {
    switch (id) {
      case 'home':
        return <Home go={open} />
      case 'trade':
        return <Trade />
      case 'cayman':
        return <Cayman />
      case 'agents':
        return <Agents />
      case 'dashboard':
        return <Dashboard />
      case 'how':
        return <HowItWorks />
      case 'docs':
        return <Documents />
      default:
        return null
    }
  }

  return (
    <>
      <div className="desktop" onPointerDown={() => setSelected(null)}>
        <div className="icons">
          {APPS.map((a) => (
            <button
              key={a.id}
              className="icon"
              aria-pressed={selected === a.id}
              onPointerDown={(e) => {
                e.stopPropagation()
                setSelected(a.id)
              }}
              onDoubleClick={() => open(a.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') open(a.id)
              }}
            >
              <a.icon size={48} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        {windows.map((w) => (
          <Win
            key={w.id}
            chrome={w}
            active={activeId === w.id}
            narrow={narrow}
            onFocus={() => focus(w.id)}
            onClose={() => close(w.id)}
            onMinimise={() => patch(w.id, { minimised: true })}
            onToggleMax={() => patch(w.id, { maximised: !w.maximised })}
            onMove={(x, y) => patch(w.id, { x, y })}
            status={
              <>
                <span>
                  {DEMO
                    ? 'Demo data — every figure on screen is invented'
                    : unset.length > 0
                      ? `${unset.length} contract(s) not deployed yet`
                      : 'Connected'}
                </span>
                <span>{activeChain.name}</span>
                {isTestnet ? <span>Testnet</span> : null}
              </>
            }
          >
            {body(w.id)}
          </Win>
        ))}
      </div>

      <Taskbar
        windows={windows}
        activeId={activeId}
        onTaskClick={onTask}
        onStart={() => open('how')}
      />
    </>
  )
}
