import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

export type BossPose = 'idle' | 'hit' | 'heal' | 'defeated'

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

// [light facet, dark facet, accent]: deliberately muted.
const PALETTES = [
  ['#5b6b73', '#3e4a52', '#d9a441'],
  ['#7a4a45', '#573331', '#e0b25a'],
  ['#5f6b4f', '#434d37', '#d9c27a'],
  ['#5e5870', '#413d4f', '#c9a0a0'],
  ['#80673f', '#5c4929', '#d5d0c0'],
  ['#4a6670', '#334a52', '#d98a6a'],
]

type Pt = [number, number]

/** A boss is a faceted body of triangles (so it can shatter), horns, eyes and a jagged mouth, all from one seed. */
export function buildBoss(seed: number) {
  const r = rng(seed * 2654435761 + 17)
  const pal = PALETTES[Math.floor(r() * PALETTES.length)]
  const n = 5 + Math.floor(r() * 3)
  const half: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const bulge = Math.sin(t * Math.PI) * 0.45 + 0.55
    half.push([100 - (36 + r() * 38) * bulge + (i === 0 || i === n - 1 ? 14 : 0), 26 + t * 152 + (r() - 0.5) * 8])
  }
  const outline: Pt[] = [...half, ...[...half].reverse().map(([x, y]): Pt => [200 - x, y])]
  const centre: Pt = [100, 104]
  const facets = outline.map((p, i) => {
    const q = outline[(i + 1) % outline.length]
    const a = r() * Math.PI * 2, d = 90 + r() * 80
    return { pts: [centre, p, q] as Pt[], dark: (i * 7 + Math.floor(r() * 3)) % 3 === 0, fly: { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, rotate: (r() - 0.5) * 220 } }
  })
  const horns = Math.floor(r() * 3)
  const hornShapes = Array.from({ length: horns }, (_, i) => {
    const x = 100 - (28 + i * 20), tip = 4 + i * 6
    const left: Pt[] = [[x - 6, 44 + i * 6], [x - 14 - r() * 8, tip], [x + 9, 40 + i * 6]]
    return [left, left.map(([px, py]): Pt => [200 - px, py])]
  }).flat()
  const eyeCount = 1 + Math.floor(r() * 3)
  const eyes = eyeCount === 1
    ? [[[84, 80], [116, 80], [108, 90], [92, 90]] as Pt[]]
    : eyeCount === 2
      ? [[[66, 76], [92, 84], [84, 92], [64, 88]] as Pt[], [[134, 76], [108, 84], [116, 92], [136, 88]] as Pt[]]
      : [[[62, 80], [84, 86], [78, 94], [62, 90]] as Pt[], [[138, 80], [116, 86], [122, 94], [138, 90]] as Pt[], [[92, 62], [108, 62], [104, 72], [96, 72]] as Pt[]]
  const teeth = 5 + Math.floor(r() * 3)
  const mouthY = 128 + r() * 10
  const mouth: Pt[] = Array.from({ length: teeth * 2 + 1 }, (_, i) => [64 + (72 * i) / (teeth * 2), mouthY + (i % 2 ? 11 : 0)])
  return { pal, facets, hornShapes, eyes, mouth, outline }
}

const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ')

export function BossArt({ seed, size = 180, pose = 'idle', label }: { seed: number; size?: number; pose?: BossPose; label?: string }) {
  const reduce = useReducedMotion()
  const b = useMemo(() => buildBoss(seed), [seed])
  const [light, dark, accent] = b.pal
  const defeated = pose === 'defeated'

  return (
    <motion.svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label ?? 'Boss'}
      animate={reduce ? undefined : pose === 'hit' ? { x: [0, -9, 7, -5, 3, 0], filter: ['brightness(1)', 'brightness(1.9)', 'brightness(1)'] }
        : pose === 'idle' ? { y: [0, -3, 0] } : { x: 0 }}
      transition={pose === 'idle' ? { repeat: Infinity, duration: 4, ease: 'easeInOut' } : { duration: 0.5 }}>
      <ellipse cx="100" cy="188" rx="52" ry="5" fill="currentColor" opacity="0.12" />
      {b.hornShapes.map((h, i) => (
        <motion.polygon key={`h${i}`} points={pts(h)} fill={dark} animate={defeated ? { opacity: 0, y: -40 } : { opacity: 1, y: 0 }} transition={{ duration: 0.8 }} />
      ))}
      {b.facets.map((f, i) => (
        <motion.polygon key={i} points={pts(f.pts)} fill={f.dark ? dark : light} stroke={dark} strokeWidth="0.6" strokeLinejoin="round"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={defeated ? { ...f.fly, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: defeated ? 0.9 : 0.3, ease: 'easeOut', delay: defeated ? i * 0.015 : 0 }} />
      ))}
      {b.eyes.map((e, i) => (
        <motion.polygon key={`e${i}`} points={pts(e)} fill={accent} animate={defeated ? { opacity: 0 } : { opacity: pose === 'hit' ? 0.4 : 1 }} transition={{ duration: 0.3 }} />
      ))}
      <motion.polyline points={pts(b.mouth)} fill="none" stroke={accent} strokeWidth="2.2" strokeLinejoin="miter" animate={{ opacity: defeated ? 0 : 0.9 }} transition={{ duration: 0.4 }} />
      {pose === 'heal' && !reduce && (
        <motion.polygon points={pts(b.outline)} fill="#5aa883" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.45, 0] }} transition={{ duration: 0.9 }} />
      )}
    </motion.svg>
  )
}
