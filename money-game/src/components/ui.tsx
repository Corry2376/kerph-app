import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })

export const num = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>{children}</section>
}

export function Btn({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const look = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-400',
    ghost: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  }[variant]
  return <button {...p} className={`min-h-11 rounded-xl px-4 py-2 font-semibold transition active:scale-95 ${look} ${className}`} />
}

export function ProgressBar({ value, max, color = '#6366f1', label }: { value: number; max: number; color?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
      className="h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Field({ label, hint, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <input {...p} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-600 dark:bg-slate-900" />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 text-lg font-extrabold tracking-tight">{children}</h2>
