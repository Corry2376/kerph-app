import { describe, expect, it } from 'vitest'
import { computeState } from './engine'
import { cyclesUntilMonth, monthLabel, nextYearPlan, suggestedSetAside } from './plans'
import { seasonFixture } from './fixtures'
import type { EngineInput, GameEvent, Plan } from './types'

const xmas: Plan = { id: 'x', name: 'Christmas', month: '2026-12', budget: 600, yearly: true }

describe('funding schedule', () => {
  it('counts paydays up to the first of the event month, including the current one', () => {
    expect(cyclesUntilMonth('2026-10-23', '2026-12', 7)).toBe(6) // 10/23 ... 11/27
    expect(cyclesUntilMonth('2026-10-23', '2026-12', 14)).toBe(3) // 10/23, 11/6, 11/20
    expect(cyclesUntilMonth('2026-12-04', '2026-12', 7)).toBe(1) // already in the month
    expect(cyclesUntilMonth('2027-01-08', '2026-12', 7)).toBe(1) // past
  })

  it('suggests an even set-aside, rounded up, and nothing once funded', () => {
    expect(suggestedSetAside(xmas, 0, '2026-10-23', 7)).toBe(100)
    expect(suggestedSetAside(xmas, 250, '2026-10-23', 7)).toBe(58.34)
    expect(suggestedSetAside(xmas, 600, '2026-10-23', 7)).toBe(0)
    expect(suggestedSetAside(xmas, 100, '2026-12-04', 7)).toBe(500) // late: the rest, now
  })

  it('rolls a yearly event forward', () => {
    expect(nextYearPlan(xmas, 'y')).toEqual({ ...xmas, id: 'y', month: '2027-12' })
    expect(monthLabel('2026-12')).toBe('Dec 2026')
  })
})

describe('plans in the engine', () => {
  const base = (events: Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>[]): EngineInput => {
    const f = seasonFixture()
    return { ...f, plans: [xmas], cycles: f.cycles.slice(0, 1), events: events.map((e, i) => ({ id: `p${i}`, timestamp: i, cycleId: 'c1', ...e })) }
  }

  it('tracks what is funded and spent per plan', () => {
    const s = computeState(base([
      { type: 'planFund', planId: 'x', amount: 100 },
      { type: 'planFund', planId: 'x', amount: 100 },
      { type: 'planSpend', planId: 'x', amount: 35.5 },
    ]))
    expect(s.plans).toEqual([{ id: 'x', funded: 200, spent: 35.5, closed: false }])
  })

  it('closing at or under budget earns points, over budget does not', () => {
    const under = computeState(base([{ type: 'planSpend', planId: 'x', amount: 600 }, { type: 'planClose', planId: 'x', amount: 0 }]))
    expect(under.cycles[0].breakdown.plans).toBe(50)
    expect(under.plans[0]).toMatchObject({ closed: true, closedCycleId: 'c1' })
    const over = computeState(base([{ type: 'planSpend', planId: 'x', amount: 601 }, { type: 'planClose', planId: 'x', amount: 0 }]))
    expect(over.cycles[0].breakdown.plans).toBe(0)
  })

  it('closing twice pays once, and unknown plans are rejected', () => {
    const s = computeState(base([{ type: 'planClose', planId: 'x', amount: 0 }, { type: 'planClose', planId: 'x', amount: 0 }]))
    expect(s.cycles[0].breakdown.plans).toBe(50)
    expect(() => computeState(base([{ type: 'planFund', planId: 'nope', amount: 1 }]))).toThrow()
  })

  it('inputs without plans still work', () => {
    expect(computeState(seasonFixture()).plans).toEqual([])
  })
})
