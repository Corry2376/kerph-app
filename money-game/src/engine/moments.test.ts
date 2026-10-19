import { describe, expect, it } from 'vitest'
import { computeAchievements } from './achievements'
import { computeState } from './engine'
import { createPicker } from './messages'
import { deriveMoments, type Moment } from './moments'
import { seasonFixture } from './fixtures'
import type { EngineInput, GameEvent } from './types'

function momentsFor(full: EngineInput, cycleIndex: number): Moment[] {
  const ids = full.cycles.slice(0, cycleIndex + 1).map(c => c.id)
  const upTo = (n: number): EngineInput => ({
    ...full, cycles: full.cycles.slice(0, n), events: full.events.filter(e => ids.slice(0, n).includes(e.cycleId)),
  })
  const before = upTo(cycleIndex), after = upTo(cycleIndex + 1)
  const bs = computeState(before), as = computeState(after)
  return deriveMoments({
    input: after, before: bs, after: as, cycleId: ids[cycleIndex],
    newEvents: after.events.filter(e => e.cycleId === ids[cycleIndex]),
    achievementsBefore: Object.keys(computeAchievements(before, bs)),
    achievementsAfter: Object.keys(computeAchievements(after, as)),
    pick: createPicker(() => 0.5),
  })
}

const kinds = (m: Moment[]) => m.map(x => x.kind)

describe('moments', () => {
  it('c10 of the season: hit, defeat, level up, lane, streak milestone, achievement, summary', () => {
    const m = momentsFor(seasonFixture(), 9)
    expect(kinds(m)).toEqual(['bossHit', 'bossDefeated', 'levelUp', 'laneUnder', 'streakMilestone', 'achievement', 'gameNight'])
    const hit = m[0]
    expect(hit.hpBefore).toBe(70)
    expect(hit.hpAfter).toBe(0)
    expect(m.find(x => x.kind === 'achievement')!.achievementKey).toBe('bossSlayer')
    expect(m.find(x => x.kind === 'levelUp')!.level).toBe(2)
    expect(m[m.length - 1].xp).toBe(1594)
  })

  it('a comeback after a missed week says so and unlocks Comeback Kid', () => {
    const m = momentsFor(seasonFixture(), 7) // c8 follows the missed c7
    expect(kinds(m)).toContain('missedWeek')
    expect(m.filter(x => x.kind === 'achievement').map(x => x.achievementKey)).toContain('comebackKid')
  })

  it('interest heals the boss and is shown with the new health', () => {
    const m = momentsFor(seasonFixture(), 0)
    const heal = m.find(x => x.kind === 'bossHeal')!
    expect(heal.amount).toBe(10)
    expect(heal.hpAfter).toBe(1000 - 120 + 10)
  })

  it('every behaviour in the points table produces a reaction with a message', () => {
    const f = seasonFixture()
    const e = (i: number, p: Partial<GameEvent> & Pick<GameEvent, 'type' | 'amount'>): GameEvent => ({ id: `p${i}`, timestamp: i, cycleId: 'c1', ...p })
    const input: EngineInput = { ...f, plans: [{ id: 'P', name: 'Birthday', month: '2026-10', budget: 100, yearly: false }], cycles: f.cycles.slice(0, 1), events: [
      e(0, { type: 'planSpend', planId: 'P', amount: 80 }),
      e(9, { type: 'planClose', planId: 'P', amount: 0 }),
      e(1, { type: 'laneSpend', laneId: 'kids', amount: 40 }),
      e(2, { type: 'sweep', laneId: 'kids', bossId: 'A', amount: 20 }),
      e(3, { type: 'payment', bossId: 'A', amount: 500, extra: true }),
      e(4, { type: 'payment', bossId: 'A', amount: 500 }),
      e(5, { type: 'deposit', questId: 'Q', amount: 1000 }),
      e(6, { type: 'noSpendDay', amount: 2 }),
      e(7, { type: 'windfall', amount: 300, followedSplit: true }),
      e(8, { type: 'gameNight', amount: 0 }),
    ] }
    const empty: EngineInput = { ...input, events: [] }
    const as = computeState(input)
    const m = deriveMoments({
      input, before: computeState(empty), after: as, cycleId: 'c1', newEvents: input.events,
      achievementsBefore: [], achievementsAfter: Object.keys(computeAchievements(input, as)),
      pick: createPicker(() => 0.5),
    })
    for (const k of ['gameNight', 'laneUnder', 'sweep', 'extraDamage', 'levelUp', 'bossDefeated', 'noSpendDay', 'bonusSplit', 'bossHit', 'planClosed'])
      expect(kinds(m), k).toContain(k)
    for (const x of m) { expect(x.message.length).toBeGreaterThan(10); expect(x.message).not.toMatch(/[{}]/) }
  })
})
