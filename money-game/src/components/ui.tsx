import { motion, useReducedMotion } from 'framer-motion'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { fmtMoney } from '../engine/format'

export const money = fmtMoney

export const num = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>{children}</section>
}

export function Btn({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const look = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400',
    ghost: 'border border-stone-300 bg-transparent text-zinc-800 hover:bg-stone-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800',
    danger: 'bg-rose-800 text-white hover:bg-rose-700',
  }[variant]
  return <button {...p} className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold tracking-wide transition active:scale-[0.98] ${look} ${className}`} />
}

const SEGMENTS = 24
const segmentMask = `repeating-linear-gradient(90deg, #000 0, #000 calc(100% / ${SEGMENTS} - 2px), transparent calc(100% / ${SEGMENTS} - 2px), transparent calc(100% / ${SEGMENTS}))`

/**
 * Segmented bar. The faint trailing layer lags behind the solid one, so a drop in value reads as damage landing.
 */
export function ProgressBar({ value, max, color = '#c8963e', label, height = 14 }: { value: number; max: number; color?: string; label?: string; height?: number }) {
  const reduce = useReducedMotion()
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
      className="relative w-full overflow-hidden bg-stone-200 dark:bg-zinc-800" style={{ height, WebkitMaskImage: segmentMask, maskImage: segmentMask }}>
      <motion.div className="absolute inset-y-0 left-0" style={{ background: color, opacity: 0.35 }}
        initial={false} animate={{ width: `${pct}%` }} transition={reduce ? { duration: 0 } : { delay: 0.45, duration: 0.9, ease: 'easeOut' }} />
      <motion.div className="absolute inset-y-0 left-0" style={{ background: color }}
        initial={false} animate={{ width: `${pct}%` }} transition={reduce ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }} />
    </div>
  )
}

export function Field({ label, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      <input {...p} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950" />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

export const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 text-base font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">{children}</h2>

export const LaneMark = ({ color, name }: { color: string; name: string }) => (
  <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-sm text-xs font-bold text-white" style={{ background: color }}>{name.slice(0, 1).toUpperCase()}</span>
)
