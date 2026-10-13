/**
 * Icons, drawn on a 16x16 grid and scaled up so the edges stay hard.
 *
 * All original — no Microsoft artwork is used or reproduced anywhere in this
 * app. The look comes from the constraints (limited palette, 1px black
 * outlines, chunky forms), not from copied assets.
 */

type Props = { size?: number; className?: string }

function Grid({ size = 32, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      {children}
    </svg>
  )
}

/** Wallet — a billfold with a note poking out. */
export function WalletIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="1" y="4" width="14" height="9" fill="#000" />
      <rect x="2" y="5" width="12" height="7" fill="#7b4b1e" />
      <rect x="3" y="2" width="9" height="3" fill="#000" />
      <rect x="4" y="3" width="7" height="2" fill="#e8e4b0" />
      <rect x="9" y="7" width="6" height="4" fill="#000" />
      <rect x="10" y="8" width="4" height="2" fill="#d8b400" />
    </Grid>
  )
}

/** Trade — two arrows swapping. */
export function TradeIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="2" y="4" width="10" height="2" fill="#006000" />
      <rect x="10" y="2" width="2" height="2" fill="#006000" />
      <rect x="12" y="4" width="2" height="2" fill="#006000" />
      <rect x="10" y="6" width="2" height="2" fill="#006000" />
      <rect x="4" y="10" width="10" height="2" fill="#a00000" />
      <rect x="4" y="8" width="2" height="2" fill="#a00000" />
      <rect x="2" y="10" width="2" height="2" fill="#a00000" />
      <rect x="4" y="12" width="2" height="2" fill="#a00000" />
    </Grid>
  )
}

/** Cayman — an island with a palm. */
export function IslandIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="0" y="11" width="16" height="5" fill="#2878c8" />
      <rect x="0" y="12" width="4" height="1" fill="#7bb4e8" />
      <rect x="9" y="13" width="5" height="1" fill="#7bb4e8" />
      <rect x="3" y="9" width="10" height="2" fill="#e8d49b" />
      <rect x="4" y="8" width="8" height="1" fill="#e8d49b" />
      <rect x="7" y="4" width="2" height="5" fill="#7b4b1e" />
      <rect x="4" y="3" width="3" height="1" fill="#1a8040" />
      <rect x="9" y="3" width="3" height="1" fill="#1a8040" />
      <rect x="3" y="4" width="2" height="1" fill="#1a8040" />
      <rect x="11" y="4" width="2" height="1" fill="#1a8040" />
      <rect x="6" y="2" width="4" height="2" fill="#1a8040" />
    </Grid>
  )
}

/** Agents — a suit and a hat brim, no face. */
export function AgentIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="4" y="1" width="8" height="2" fill="#101010" />
      <rect x="2" y="3" width="12" height="1" fill="#101010" />
      <rect x="5" y="4" width="6" height="4" fill="#c89a70" />
      <rect x="6" y="5" width="1" height="1" fill="#101010" />
      <rect x="9" y="5" width="1" height="1" fill="#101010" />
      <rect x="3" y="8" width="10" height="8" fill="#1c2a50" />
      <rect x="7" y="8" width="2" height="5" fill="#fff" />
      <rect x="7" y="9" width="2" height="4" fill="#a00000" />
      <rect x="2" y="9" width="1" height="7" fill="#1c2a50" />
      <rect x="13" y="9" width="1" height="7" fill="#1c2a50" />
    </Grid>
  )
}

/** Dashboard — a CRT with a bar chart. */
export function MonitorIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="1" y="2" width="14" height="10" fill="#101010" />
      <rect x="2" y="3" width="12" height="8" fill="#c0c0c0" />
      <rect x="3" y="7" width="2" height="3" fill="#000080" />
      <rect x="6" y="5" width="2" height="5" fill="#000080" />
      <rect x="9" y="8" width="2" height="2" fill="#a00000" />
      <rect x="6" y="12" width="4" height="2" fill="#909090" />
      <rect x="4" y="14" width="8" height="1" fill="#707070" />
    </Grid>
  )
}

/** How it works — a help book. */
export function HelpIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="2" y="1" width="12" height="14" fill="#000" />
      <rect x="3" y="2" width="10" height="12" fill="#f0f0e0" />
      <rect x="3" y="2" width="3" height="12" fill="#d0c8a8" />
      <rect x="8" y="4" width="4" height="1" fill="#000080" />
      <rect x="11" y="5" width="1" height="2" fill="#000080" />
      <rect x="9" y="7" width="3" height="1" fill="#000080" />
      <rect x="9" y="8" width="1" height="2" fill="#000080" />
      <rect x="9" y="11" width="1" height="1" fill="#000080" />
    </Grid>
  )
}

/** Melting cash, for the tray and the balance readout. */
export function MeltIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="1" y="4" width="14" height="7" fill="#000" />
      <rect x="2" y="5" width="12" height="5" fill="#4a9c60" />
      <rect x="6" y="6" width="4" height="3" fill="#8ed0a0" />
      <rect x="3" y="11" width="2" height="3" fill="#4a9c60" />
      <rect x="7" y="11" width="2" height="4" fill="#4a9c60" />
      <rect x="12" y="11" width="2" height="2" fill="#4a9c60" />
    </Grid>
  )
}

export function StartIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="1" y="3" width="6" height="5" fill="#c00000" />
      <rect x="8" y="2" width="7" height="6" fill="#008000" />
      <rect x="1" y="9" width="6" height="6" fill="#000080" />
      <rect x="8" y="9" width="7" height="5" fill="#d8b400" />
    </Grid>
  )
}
