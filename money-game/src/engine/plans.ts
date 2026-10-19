import type { Plan } from './types'

const parts = (iso: string) => iso.split('-').map(Number)

export function monthLabel(month: string): string {
  const [y, m] = parts(month)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Paydays on or before the first of the event's month, counting the current one. At least 1. */
export function cyclesUntilMonth(payday: string, month: string, cycleLength: number): number {
  const [py, pm, pd] = parts(payday)
  const [y, m] = parts(month)
  const days = (Date.UTC(y, m - 1, 1) - Date.UTC(py, pm - 1, pd)) / 86_400_000
  return days <= 0 ? 1 : Math.floor(days / cycleLength) + 1
}

/** What to set aside each pay cycle so the event is fully funded by its month. */
export function suggestedSetAside(plan: Plan, funded: number, payday: string, cycleLength: number): number {
  const remaining = Math.max(0, plan.budget - funded)
  if (remaining === 0) return 0
  return Math.ceil((remaining / cyclesUntilMonth(payday, plan.month, cycleLength)) * 100) / 100
}

/** The same event next year, for plans marked yearly. */
export function nextYearPlan(plan: Plan, id: string): Plan {
  const [y, m] = parts(plan.month)
  return { ...plan, id, month: `${y + 1}-${String(m).padStart(2, '0')}` }
}
