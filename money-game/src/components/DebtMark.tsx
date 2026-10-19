import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

export type MarkPose = 'idle' | 'payment' | 'interest' | 'cleared'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// [light facet, dark facet, edge]: muted stone, slate and brass.
const PALETTES = [
  ['#7b8790', '#56626b', '#c9b27c'],
  ['#8a6a62', '#654b45', '#d2bd8c'],
  ['#74806a', '#555f4d', '#cfc59a'],
  ['#74708a', '#545066', '#c9b8b0'],
  ['#8c7a55', '#695a3d', '#d8d3c6'],
  ['#62808b', '#496169', '#d4a98e'],
]

type Pt = [number, number]

/**
 * Each debt gets its own faceted stone, generated from a seed. It is built from triangles so it can
 * fracture and fall away when the balance reaches zero.
 */
export function buildMark(seed: number) {
  const r = rng(seed * 2654435761 + 17)
  const pal = PALETTES[Math.floor(r() * PALETTES.length)]
  const n = 5 + Math.floor(r() * 3)
  const half: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const bulge = Math.sin(t * Math.PI) * 0.5 + 0.5
    half.push([100 - (34 + r() * 40) * bulge + (i === 0 || i === n - 1 ? 14 : 0), 24 + t * 152 + (r() - 0.5) * 8])
  }
  const outline: Pt[] = [...half, ...[...half].reverse().map(([x, y]): Pt => [200 - x, y])]
  const centre: Pt = [100 + (r() - 0.5) * 14, 98 + (r() - 0.5) * 20]
  const facets = outline.map((p, i) => {
    const q = outline[(i + 1) % outline.length]
    const a = r() * Math.PI * 2, d = 80 + r() * 90
    return { pts: [centre, p, q] as Pt[], shade: (i * 5 + Math.floor(r() * 3)) % 3, fly: { x: Math.cos(a) * d, y: Math.sin(a) * d + 20, rotate: (r() - 0.5) * 200 } }
  })
  return { pal, facets, outline }
}

const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ')

export function DebtMark({ seed, size = 160, pose = 'idle', label }: { seed: number; size?: number; pose?: MarkPose; label?: string }) {
  const reduce = useReducedMotion()
  const m = useMemo(() => buildMark(seed), [seed])
  const [light, dark, edge] = m.pal
  const cleared = pose === 'cleared'
  const fills = [light, dark, `color-mix(in srgb, ${light} 55%, ${dark})`]

  return (
    <motion.svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label ?? 'Debt'}
      animate={reduce ? undefined : pose === 'payment' ? { scale: [1, 1.04, 1], filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'] } : { scale: 1 }}
      transition={{ duration: 0.5 }}>
      <ellipse cx="100" cy="188" rx="50" ry="4" fill="currentColor" opacity="0.1" />
      {m.facets.map((f, i) => (
        <motion.polygon key={i} points={pts(f.pts)} fill={fills[f.shade]} stroke={edge} strokeOpacity={0.55} strokeWidth="0.8" strokeLinejoin="round"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={cleared ? { ...f.fly, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: cleared ? 1 : 0.3, ease: 'easeOut', delay: cleared ? i * 0.02 : 0 }} />
      ))}
      <motion.polygon points={pts(m.outline)} fill="none" stroke={edge} strokeWidth="1.4" strokeLinejoin="round"
        animate={{ opacity: cleared ? 0 : 0.8 }} transition={{ duration: 0.4 }} />
      {pose === 'interest' && !reduce && (
        <motion.polygon points={pts(m.outline)} fill="#b4574d" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 0.9 }} />
      )}
    </motion.svg>
  )
}
