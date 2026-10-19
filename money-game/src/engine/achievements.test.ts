import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, computeAchievements } from './achievements'
import { computeState } from './engine'
import { lifetimeStats } from './stats'
import { seasonFixture } from './fixtures'
import type { EngineInput, GameEvent } from './types'

const run = (input: EngineInput) => computeAchievements(input, computeState(input))

describe('achievements', () => {
  const full = seasonFixture()
  const got = run(full)

  it('defines the eight starters', () => {
    expect(ACHIEVEMENTS.map(a => a.key)).toEqual([
      'firstBlood', 'bossSlayer', 'ironStreak', 'cleanSweep', 'levelUp', 'comebackKid', 'seasonChamp', 'windfallWizard',
    ])
  })

  it('unlocks in the cycle it happened, from the season fixture', () => {
    expect(got.firstBlood).toBe('c1')
    expect(got.levelUp).toBe('c5')
    expect(got.bossSlayer).toBe('c10')
    expect(got.comebackKid).toBe('c8') // c7 was missed, c8 came back
  })

  it('leaves the rest locked', () => {
    expect(got.ironStreak).toBeUndefined() // longest streak is 6
    expect(got.cleanSweep).toBeUndefined() // tools lane always over budget
    expect(got.windfallWizard).toBeUndefined()
    expect(got.seasonChamp).toBeUndefined() // needs seasons (phase 3)
  })

  it('iron streak at 10, clean sweep when every lane is under, windfall wizard when the split is followed', () => {
    const f = seasonFixture()
    const cycles = f.cycles.slice(0, 1)
    const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'type' | 'amount'>, i: number): GameEvent =>
      ({ id: `x${i}`, timestamp: i, cycleId: 'c1', ...e })
    const clean = run({ ...f, cycles, events: [
      ev({ type: 'laneSpend', laneId: 'kids', amount: 10 }, 1),
      ev({ type: 'windfall', amount: 100, followedSplit: true }, 2),
      ev({ type: 'gameNight', amount: 0 }, 3),
    ] })
    expect(clean.cleanSweep).toBe('c1')
    expect(clean.windfallWizard).toBe('c1')

    const ten = { ...f, cycles: f.cycles.slice(0, 10), events: f.cycles.slice(0, 10).map((c, i) => ev({ type: 'gameNight', amount: 0, cycleId: c.id }, i)) }
    expect(run(ten).ironStreak).toBe('c10')
  })

  it('windfall without following the split does not unlock the wizard', () => {
    const f = seasonFixture()
    const r = run({ ...f, cycles: f.cycles.slice(0, 1), events: [{ id: 'w', timestamp: 1, cycleId: 'c1', type: 'windfall', amount: 100, followedSplit: false }] })
    expect(r.windfallWizard).toBeUndefined()
  })
})

describe('lifetime stats', () => {
  it('summarises the season fixture', () => {
    const f = seasonFixture()
    const s = lifetimeStats(f, computeState(f))
    expect(s).toEqual({
      careerXp: 2844, bossesDefeated: 1, levelsCleared: 2, longestStreak: 6, gameNights: 12,
      totalSwept: 40, totalDamage: 1010 + 300, // A absorbed 1,010 (1,000 + 10 interest) before falling, B took 300
    })
  })
})
