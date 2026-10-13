import { useState } from 'react'
import { BlackCat, GoldenDog, SpottedPup, TabbyCat } from '../components/win/Pets'

/**
 * "Super important documents" — a folder of pets, filed where an offshore
 * accountant would hide the thing he actually cares about.
 *
 * Photos are picked up from src/assets/pets at build time via import.meta.glob,
 * so adding one is dropping a file in a directory. Vite fingerprints them, which
 * also means swapping a photo doesn't get served from cache.
 *
 * With no photos present it falls back to the drawn pixel pets, so a fresh
 * checkout still shows something.
 */
const photoModules = import.meta.glob<string>(
  '../assets/pets/*.{jpg,jpeg,png,webp,gif}',
  { eager: true, import: 'default' },
)

const photos = Object.entries(photoModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    file: path.split('/').pop() ?? 'image',
  }))

/** Straight-faced filenames, cycled over however many photos are present. */
const COVER_NAMES = [
  { name: 'quarterly_projections', caption: 'Chief Financial Officer' },
  { name: 'audit_response_FINAL', caption: 'Refuses to comment on the record' },
  { name: 'offshore_structure_v2', caption: 'Good boy. Terrible with money' },
  { name: 'DO_NOT_OPEN', caption: 'Opened it anyway' },
  { name: 'receipts_2019_scan', caption: 'Chewed the receipts' },
  { name: 'compliance_review', caption: 'Asleep during the review' },
] as const

type Entry = {
  id: string
  label: string
  caption: string
  url?: string
  art?: (p: { size?: number }) => JSX.Element
}

const drawn = [TabbyCat, BlackCat, GoldenDog, SpottedPup]

const entries: Entry[] =
  photos.length > 0
    ? photos.map((p, i) => {
        const meta = COVER_NAMES[i % COVER_NAMES.length]
        const ext = p.file.split('.').pop()
        return {
          id: p.file,
          label: `${meta.name}.${ext}`,
          caption: meta.caption,
          url: p.url,
        }
      })
    : drawn.map((art, i) => ({
        id: `drawn-${i}`,
        label: `${COVER_NAMES[i].name}.bmp`,
        caption: COVER_NAMES[i].caption,
        art,
      }))

export function Documents() {
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const current = entries.find((e) => e.id === open)

  if (current) {
    const Art = current.art
    return (
      <div className="stack">
        <div
          className="sunken"
          style={{
            padding: 14,
            display: 'grid',
            placeItems: 'center',
            background: '#fff',
          }}
        >
          {current.url ? (
            <img
              src={current.url}
              alt={current.caption}
              loading="lazy"
              style={{ maxWidth: '100%', maxHeight: '48vh', display: 'block' }}
            />
          ) : Art ? (
            <Art size={200} />
          ) : null}
        </div>
        <p style={{ textAlign: 'center' }}>{current.caption}</p>
        <div className="btn-row">
          <button className="btn" onClick={() => setOpen(null)}>
            Back to folder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="filelist">
        {entries.map((e) => {
          const Art = e.art
          return (
            <button
              key={e.id}
              className="icon fileicon"
              aria-pressed={selected === e.id}
              onPointerDown={() => setSelected(e.id)}
              onDoubleClick={() => setOpen(e.id)}
              onKeyDown={(k) => {
                if (k.key === 'Enter') setOpen(e.id)
              }}
            >
              {e.url ? (
                <img
                  src={e.url}
                  alt=""
                  loading="lazy"
                  style={{
                    width: 44,
                    height: 44,
                    objectFit: 'cover',
                    border: '1px solid #808080',
                  }}
                />
              ) : Art ? (
                <Art size={44} />
              ) : null}
              <span>{e.label}</span>
            </button>
          )
        })}
      </div>
      <p className="muted">
        {entries.length} objects. Double-click to open. None of this is a
        financial document.
      </p>
    </div>
  )
}
