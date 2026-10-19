import confetti from 'canvas-confetti'

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Muted brass, bone, sage and brick rather than primary colors.
const COLORS = ['#c8963e', '#e7e2d6', '#7f9484', '#b4574d', '#8a8f98']

export function burst(size: 'small' | 'medium' | 'large' = 'medium') {
  if (prefersReducedMotion()) return
  const n = { small: 40, medium: 90, large: 180 }[size]
  confetti({ particleCount: n, spread: size === 'large' ? 100 : 70, startVelocity: 38, origin: { y: 0.62 }, colors: COLORS, scalar: 0.8, ticks: 160, disableForReducedMotion: true })
  if (size === 'large') setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, scalar: 0.8 }), 250)
  if (size === 'large') setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, scalar: 0.8 }), 400)
}
