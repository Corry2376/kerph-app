import { describe, expect, it } from 'vitest'
import { computeState, multiplierFor } from './engine'
import { DEFAULT_CONFIG, sortBossQueue } from './config'
import { seasonFixture } from './fixtures'
import type { EngineInput, GameEvent } from './types'

const base = (): EngineInput => {
  const f = seasonFixture()
  return { ...f, cycles: [f.cycles[0]], events: [] }
}
let n = 0
const ev = (e: Partial<GameEvent> & Pick<GameEvent, 'type' | 'amount'>): GameEvent =>
  ({ id: `t${++n}`, timestamp: n, cycleId: 'c1', ...e })

describe('multiplierFor', () => {
  it('steps at 3, 6 and 10', () => {
    const m = (s: number) => multiplierFor(DEFAULT_CONFIG, s)
    expect([0, 1, 2, 3, 5, 6, 9, 10, 40].map(m)).toEqual([1, 1, 1, 1.25, 1.25, 1.5, 1.5, 2, 2])
  })
})

describe('bosses', () => {
  it('payments damage and interest heals', () => {
    const s = computeState({ ...base(), events: [
      ev({ type: 'payment', bossId: 'A', amount: 300 }),
      ev({ type: 'interest', bossId: 'A', amount: 38 }),
    ] })
    const a = s.bosses.find(b => b.id === 'A')!
    expect(a.currentBalance).toBe(738)
    expect(a.hits.map(h => h.amount)).toEqual([300])
    expect(a.heals.map(h => h.amount)).toEqual([38])
  })

  it('first non-defeated boss in queue order is active', () => {
    const s = computeState({ ...base(), events: [] })
    expect(s.activeBossId).toBe('A')
    expect(s.bosses.map(b => b.status)).toEqual(['active', 'queued'])
  })

  it('defeat clamps at zero, awards XP once, and rolls attack power forward', () => {
    const s = computeState({ ...base(), events: [ev({ type: 'payment', bossId: 'A', amount: 1500 })] })
    expect(s.bosses[0].currentBalance).toBe(0)
    expect(s.bosses[0].status).toBe('defeated')
    expect(s.activeBossId).toBe('B')
    expect(s.attackPower).toBe(25 + 75 + 50 + 0)
    expect(s.bossDefeats).toEqual([{ cycleId: 'c1', bossId: 'A' }])
    expect(s.cycles[0].breakdown.bossDefeated).toBe(1000)
  })

  it('new interest on a defeated card is a rematch, with no second defeat bounty', () => {
    const s = computeState({ ...base(), events: [
      ev({ type: 'payment', bossId: 'A', amount: 1000 }),
      ev({ type: 'interest', bossId: 'A', amount: 20 }),
      ev({ type: 'payment', bossId: 'A', amount: 20 }),
    ] })
    expect(s.bosses[0].status).toBe('defeated')
    expect(s.bossDefeats).toHaveLength(1)
    const mid = computeState({ ...base(), events: [
      ev({ type: 'payment', bossId: 'A', amount: 1000 }),
      ev({ type: 'interest', bossId: 'A', amount: 20 }),
    ] })
    expect(mid.bosses[0].status).toBe('rematch')
    expect(mid.activeBossId).toBe('A')
  })
})

describe('quests', () => {
  it('clears one level per $1,000 and logs level-ups with the cycle they happened in', () => {
    const s = computeState({ ...base(), events: [ev({ type: 'deposit', questId: 'Q', amount: 2500 })] })
    expect(s.quests[0].levelsCleared).toBe(2)
    expect(s.levelUps).toEqual([
      { cycleId: 'c1', questId: 'Q', level: 1 },
      { cycleId: 'c1', questId: 'Q', level: 2 },
    ])
    expect(s.cycles[0].breakdown.levelUp).toBe(400)
  })

  it('caps levels at levelCount and flags completion', () => {
    const s = computeState({ ...base(), events: [ev({ type: 'deposit', questId: 'Q', amount: 12000 })] })
    expect(s.quests[0].levelsCleared).toBe(10)
    expect(s.quests[0].complete).toBe(true)
  })
})

describe('xp', () => {
  it('scores a single completed game night', () => {
    const s = computeState({ ...base(), events: [
      ev({ type: 'laneSpend', laneId: 'kids', amount: 99.99 }),
      ev({ type: 'laneSpend', laneId: 'tools', amount: 50 }), // exactly on budget: nothing left, no XP
      ev({ type: 'sweep', laneId: 'kids', bossId: 'A', amount: 0.01 }), // under $10: no XP
      ev({ type: 'payment', bossId: 'A', amount: 45, extra: true }), // 4 x 2
      ev({ type: 'noSpendDay', amount: 2 }),
      ev({ type: 'windfall', amount: 500, followedSplit: true }),
      ev({ type: 'gameNight', amount: 0 }),
    ] })
    expect(s.cycles[0].breakdown).toMatchObject({ gameNight: 50, lanes: 25, sweep: 0, extraBoss: 8, noSpend: 20, bonusSplit: 100 })
    expect(s.totalXp).toBe(203)
  })

  it('sweeps pay 1 XP per $10 and move the money', () => {
    const s = computeState({ ...base(), events: [
      ev({ type: 'laneSpend', laneId: 'kids', amount: 40 }),
      ev({ type: 'sweep', laneId: 'kids', bossId: 'A', amount: 35 }),
      ev({ type: 'sweep', laneId: 'kids', questId: 'Q', amount: 25 }),
    ] })
    expect(s.cycles[0].breakdown.sweep).toBe(5)
    expect(s.bosses[0].currentBalance).toBe(965)
    expect(s.quests[0].currentAmount).toBe(25)
    expect(s.lanes[0]).toMatchObject({ spent: 40, swept: 60, remaining: 0 })
  })

  it('an incomplete cycle earns no game-night, lane or multiplier XP', () => {
    const s = computeState({ ...base(), events: [ev({ type: 'laneSpend', laneId: 'kids', amount: 10 })] })
    expect(s.totalXp).toBe(0)
    expect(s.cycles[0].completed).toBe(false)
  })

  it('rejects events for unknown cycles', () => {
    expect(() => computeState({ ...base(), events: [ev({ type: 'gameNight', amount: 0, cycleId: 'nope' })] })).toThrow()
  })
})

describe('streaks', () => {
  const run = (done: boolean[], tail?: GameEvent[]) => {
    const f = seasonFixture()
    const cycles = done.map((_, i) => f.cycles[i])
    const events = done.flatMap((d, i) => d ? [ev({ type: 'gameNight', amount: 0, cycleId: cycles[i].id })] : [])
    return computeState({ ...f, cycles, events: [...events, ...(tail ?? [])] })
  }

  it('counts consecutive completed cycles', () => {
    const s = run([true, true, true])
    expect(s.gameNightStreak).toBe(3)
    expect(s.multiplier).toBe(1.25)
    expect(s.nextMultiplier).toBe(1.25)
  })

  it('a missed cycle resets the streak but removes no XP', () => {
    const s = run([true, true, true, false, true])
    expect(s.cycles.map(c => c.streak)).toEqual([1, 2, 3, 0, 1])
    expect(s.totalXp).toBe(100 + 100 + 125 + 0 + 100) // 2 untouched lanes add 50 per completed cycle
  })

  it('the cycle in progress does not break the streak', () => {
    const s = run([true, true, false])
    expect(s.gameNightStreak).toBe(2)
  })

  it('tracks lane streaks separately', () => {
    const f = seasonFixture()
    const cycles = f.cycles.slice(0, 3)
    const events: GameEvent[] = cycles.flatMap((c, i) => [
      ev({ type: 'laneSpend', laneId: 'kids', amount: i === 1 ? 150 : 50, cycleId: c.id }),
      ev({ type: 'gameNight', amount: 0, cycleId: c.id }),
    ])
    const s = computeState({ ...f, cycles, events })
    // kids: under, over, then the in-progress cycle c3 is complete and under -> 1
    expect(s.lanes.find(l => l.id === 'kids')!.streak).toBe(1)
  })
})

describe('snowball / avalanche', () => {
  it('orders the queue', () => {
    const { bosses } = seasonFixture()
    expect(sortBossQueue(bosses, 'snowball').map(b => b.id)).toEqual(['A', 'B'])
    expect(sortBossQueue(bosses, 'avalanche').map(b => b.id)).toEqual(['A', 'B'])
    expect(sortBossQueue([...bosses].reverse(), 'snowball').map(b => b.id)).toEqual(['A', 'B'])
    const swapped = bosses.map(b => b.id === 'B' ? { ...b, rate: 30 } : b)
    expect(sortBossQueue(swapped, 'avalanche').map(b => b.id)).toEqual(['B', 'A'])
  })
})

describe('full season fixture', () => {
  const s = computeState(seasonFixture())

  it('boss health: A falls in c10 with overkill clamped, B takes the rest', () => {
    expect(s.bossDefeats).toEqual([{ cycleId: 'c10', bossId: 'A' }])
    expect(s.bosses[0].currentBalance).toBe(0)
    expect(s.bosses[1].currentBalance).toBe(2700)
    expect(s.activeBossId).toBe('B')
  })

  it('quest levels clear at c5 and c10', () => {
    expect(s.levelUps).toEqual([
      { cycleId: 'c5', questId: 'Q', level: 1 },
      { cycleId: 'c10', questId: 'Q', level: 2 },
    ])
    expect(s.quests[0].currentAmount).toBe(2600)
  })

  it('streak and multiplier per cycle', () => {
    expect(s.cycles.map(c => c.streak)).toEqual([1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6])
    expect(s.cycles.map(c => c.multiplier)).toEqual([1, 1, 1.25, 1.25, 1.25, 1.5, 1, 1, 1, 1.25, 1.25, 1.25, 1.5])
  })

  it('xp per cycle and in total (rounded per cycle)', () => {
    expect(s.cycles.map(c => c.xp)).toEqual([77, 77, 94, 94, 344, 113, 0, 75, 75, 1594, 94, 94, 113])
    expect(s.totalXp).toBe(2844)
  })

  it('lane streaks: kids always under, tools never; c7 breaks kids', () => {
    expect(s.lanes.find(l => l.id === 'kids')!.streak).toBe(6)
    expect(s.lanes.find(l => l.id === 'tools')!.streak).toBe(0)
  })
})
