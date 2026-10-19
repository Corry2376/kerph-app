import { DEFAULT_CONFIG } from './config'
import type { Cycle, EngineInput, GameEvent } from './types'

/**
 * A full 13-cycle season with hand-checkable numbers (see engine.test.ts).
 *   Boss A: $1,000 + $10 interest, boss B: $3,000.   Quest Q: $10,000 in 10 levels.
 *   Game night done every cycle except c7.   Kids lane always under budget, Tools never.
 */
export function seasonFixture(): EngineInput {
  const cycles: Cycle[] = []
  const events: GameEvent[] = []
  let n = 0
  const ev = (cycleId: string, e: Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>) =>
    events.push({ id: `e${++n}`, timestamp: n, cycleId, ...e })

  for (let i = 1; i <= 13; i++) {
    const id = `c${i}`
    cycles.push({ id, startDate: `s${i}`, endDate: `e${i}`, payday: `p${i}` })
    const bossId = i <= 10 ? 'A' : 'B'
    ev(id, { type: 'payment', bossId, amount: 100 })
    ev(id, { type: 'deposit', questId: 'Q', amount: 200 })
    if (i === 1) ev(id, { type: 'interest', bossId: 'A', amount: 10 })
    if (i === 7) continue // missed game night
    ev(id, { type: 'laneSpend', laneId: 'kids', amount: 80 })
    ev(id, { type: 'laneSpend', laneId: 'tools', amount: 60 })
    if (i <= 2) ev(id, { type: 'sweep', laneId: 'kids', bossId: 'A', amount: 20 })
    ev(id, { type: 'gameNight', amount: 0 })
  }

  return {
    config: DEFAULT_CONFIG,
    quests: [
      { id: 'Q', name: 'Quest', targetAmount: 10000, targetDate: '2031-01-01', levelCount: 10, autopilotDeposit: 200, order: 0, status: 'active' },
    ],
    bosses: [
      { id: 'A', cardNickname: 'A', last4: '0001', rate: 20, startingBalance: 1000, minPayment: 25, autopilotAttack: 75, artSeed: 1 },
      { id: 'B', cardNickname: 'B', last4: '0002', rate: 15, startingBalance: 3000, minPayment: 50, autopilotAttack: 0, artSeed: 2 },
    ],
    lanes: [
      { id: 'kids', name: 'Kids', budgetPerCycle: 100, color: '#f43f5e', icon: 'K' },
      { id: 'tools', name: 'Tools', budgetPerCycle: 50, color: '#3b82f6', icon: 'T' },
    ],
    cycles,
    events,
  }
}
