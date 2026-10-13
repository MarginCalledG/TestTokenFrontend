/**
 * Pixel pets for "Super important documents", drawn on a 16x16 grid like every
 * other icon here.
 *
 * Drawn rather than sourced: random cat photos off the internet are somebody's
 * copyrighted work, and stock sites want attribution this joke can't carry.
 * These also match the rest of the desktop, which photos wouldn't.
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

export function TabbyCat(p: Props) {
  return (
    <Grid {...p}>
      <rect x="3" y="4" width="2" height="3" fill="#c8862c" />
      <rect x="11" y="4" width="2" height="3" fill="#c8862c" />
      <rect x="3" y="6" width="10" height="7" fill="#e0a344" />
      <rect x="4" y="8" width="2" height="2" fill="#fff" />
      <rect x="10" y="8" width="2" height="2" fill="#fff" />
      <rect x="5" y="9" width="1" height="1" fill="#101010" />
      <rect x="10" y="9" width="1" height="1" fill="#101010" />
      <rect x="7" y="10" width="2" height="1" fill="#d06a7a" />
      <rect x="5" y="7" width="1" height="1" fill="#c8862c" />
      <rect x="8" y="7" width="1" height="1" fill="#c8862c" />
      <rect x="11" y="7" width="1" height="1" fill="#c8862c" />
      <rect x="2" y="11" width="1" height="1" fill="#101010" />
      <rect x="13" y="11" width="1" height="1" fill="#101010" />
      <rect x="4" y="13" width="8" height="2" fill="#e0a344" />
      <rect x="12" y="12" width="3" height="1" fill="#c8862c" />
    </Grid>
  )
}

export function BlackCat(p: Props) {
  return (
    <Grid {...p}>
      <rect x="3" y="3" width="2" height="3" fill="#2a2a32" />
      <rect x="11" y="3" width="2" height="3" fill="#2a2a32" />
      <rect x="3" y="5" width="10" height="8" fill="#3a3a44" />
      <rect x="4" y="7" width="2" height="2" fill="#8ede6a" />
      <rect x="10" y="7" width="2" height="2" fill="#8ede6a" />
      <rect x="5" y="7" width="1" height="2" fill="#101010" />
      <rect x="10" y="7" width="1" height="2" fill="#101010" />
      <rect x="7" y="10" width="2" height="1" fill="#d06a7a" />
      <rect x="4" y="13" width="8" height="2" fill="#3a3a44" />
      <rect x="1" y="10" width="2" height="1" fill="#2a2a32" />
    </Grid>
  )
}

export function GoldenDog(p: Props) {
  return (
    <Grid {...p}>
      <rect x="2" y="4" width="3" height="6" fill="#a9762e" />
      <rect x="11" y="4" width="3" height="6" fill="#a9762e" />
      <rect x="4" y="3" width="8" height="9" fill="#d8a355" />
      <rect x="5" y="6" width="2" height="2" fill="#fff" />
      <rect x="9" y="6" width="2" height="2" fill="#fff" />
      <rect x="5" y="7" width="1" height="1" fill="#101010" />
      <rect x="10" y="7" width="1" height="1" fill="#101010" />
      <rect x="6" y="9" width="4" height="3" fill="#efd0a0" />
      <rect x="7" y="9" width="2" height="2" fill="#2a2028" />
      <rect x="6" y="12" width="4" height="1" fill="#d06a7a" />
      <rect x="4" y="13" width="8" height="2" fill="#d8a355" />
    </Grid>
  )
}

export function SpottedPup(p: Props) {
  return (
    <Grid {...p}>
      <rect x="2" y="5" width="3" height="5" fill="#4a4a52" />
      <rect x="11" y="5" width="3" height="5" fill="#f2f2f2" />
      <rect x="4" y="4" width="8" height="8" fill="#f2f2f2" />
      <rect x="4" y="4" width="3" height="4" fill="#4a4a52" />
      <rect x="5" y="7" width="2" height="2" fill="#fff" />
      <rect x="9" y="7" width="2" height="2" fill="#fff" />
      <rect x="6" y="8" width="1" height="1" fill="#101010" />
      <rect x="9" y="8" width="1" height="1" fill="#101010" />
      <rect x="7" y="10" width="2" height="2" fill="#2a2028" />
      <rect x="4" y="12" width="8" height="3" fill="#f2f2f2" />
      <rect x="9" y="12" width="3" height="2" fill="#4a4a52" />
    </Grid>
  )
}

/** Folder icon for the documents window. */
export function FolderIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="1" y="3" width="6" height="2" fill="#b08420" />
      <rect x="1" y="4" width="14" height="10" fill="#e8c14a" />
      <rect x="2" y="6" width="12" height="7" fill="#f7dd86" />
      <rect x="1" y="13" width="14" height="1" fill="#b08420" />
    </Grid>
  )
}

/**
 * Generic browser shortcut. Original artwork: a window frame with a title bar
 * and a globe, plus the little arrow badge 90s .url files carried. Nothing
 * here references anyone's branding — the joke is entirely the filename and
 * the destination.
 */
export function ShortcutIcon(p: Props) {
  return (
    <Grid {...p}>
      <rect x="1" y="1" width="14" height="12" fill="#101010" />
      <rect x="2" y="2" width="12" height="10" fill="#c0c0c0" />
      <rect x="2" y="2" width="12" height="2" fill="#000080" />
      <rect x="11" y="2" width="1" height="1" fill="#c0c0c0" />
      <rect x="12" y="2" width="1" height="1" fill="#c0c0c0" />
      <rect x="3" y="5" width="10" height="7" fill="#2878c8" />
      <rect x="3" y="8" width="10" height="1" fill="#bfe3f5" />
      <rect x="7" y="5" width="2" height="7" fill="#bfe3f5" />
      <rect x="4" y="6" width="2" height="1" fill="#bfe3f5" />
      <rect x="10" y="10" width="2" height="1" fill="#bfe3f5" />
      <rect x="1" y="10" width="5" height="5" fill="#fff" />
      <rect x="1" y="10" width="5" height="1" fill="#101010" />
      <rect x="1" y="14" width="5" height="1" fill="#101010" />
      <rect x="1" y="10" width="1" height="5" fill="#101010" />
      <rect x="5" y="10" width="1" height="5" fill="#101010" />
      <rect x="2" y="13" width="1" height="1" fill="#101010" />
      <rect x="3" y="12" width="1" height="1" fill="#101010" />
      <rect x="4" y="11" width="1" height="1" fill="#101010" />
      <rect x="3" y="11" width="2" height="1" fill="#101010" />
      <rect x="4" y="11" width="1" height="2" fill="#101010" />
    </Grid>
  )
}
