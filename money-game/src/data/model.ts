import { DEFAULT_CONFIG, sortBossQueue } from '../engine/config'
import type { Boss, Config, Cycle, GameEvent, Lane, Player, Quest } from '../engine/types'

/** Everything the app persists, and exactly what export/import round-trips. */
export interface GameData {
  version: 1
  isDemo: boolean
  players: Player[]
  config: Config
  quests: Quest[]
  bosses: Boss[]
  lanes: Lane[]
  cycles: Cycle[]
  events: GameEvent[]
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const todayIso = () => new Date().toISOString().slice(0, 10)

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
export function nextWeekday(fromIso: string, weekday: string): string {
  const target = WEEKDAYS.indexOf(weekday.toLowerCase())
  const dow = new Date(`${fromIso}T00:00:00Z`).getUTCDay()
  return addDays(fromIso, (target - dow + 7) % 7)
}

export const cycleLength = (c: Config) => (c.payCycle === 'weekly' ? 7 : 14)

export function makeCycle(payday: string, config: Config): Cycle {
  return { id: payday, payday, startDate: payday, endDate: addDays(payday, cycleLength(config) - 1) }
}

export function nextCycle(prev: Cycle, config: Config): Cycle {
  return makeCycle(addDays(prev.payday, cycleLength(config)), config)
}

const LANE_STYLE: Record<string, { color: string; icon: string }> = {
  Kids: { color: '#b4574d', icon: 'K' },
  Tools: { color: '#4a6f8f', icon: 'T' },
  Travel: { color: '#5f8a6e', icon: 'V' },
  Everyday: { color: '#c8963e', icon: 'E' },
  Rewards: { color: '#7d6a99', icon: 'R' },
}
export const laneStyle = (name: string, i: number) =>
  LANE_STYLE[name] ?? { color: ['#4f8a8b', '#8a8f4a', '#a05f7d'][i % 3], icon: '•' }

export interface SetupInput {
  players: { name: string }[]
  config: Config
  firstPayday: string
  quests: Omit<Quest, 'id' | 'order' | 'status'>[]
  bosses: Omit<Boss, 'id' | 'artSeed'>[]
  lanes: { name: string; budgetPerCycle: number }[]
}

export function buildGame(s: SetupInput, isDemo = false): GameData {
  const bosses: Boss[] = s.bosses.map((b, i) => ({ ...b, id: uid(), artSeed: 1000 + i * 7919 + b.last4.length }))
  return {
    version: 1,
    isDemo,
    players: s.players.map((p, i) => ({ id: uid(), name: p.name || `Player ${i + 1}`, avatar: (p.name || `P${i + 1}`).slice(0, 1).toUpperCase() })),
    config: s.config,
    quests: s.quests.map((q, i) => ({ ...q, id: uid(), order: i, status: 'active' })),
    bosses: sortBossQueue(bosses, s.config.bossOrder),
    lanes: s.lanes.map((l, i) => ({ id: uid(), ...l, ...laneStyle(l.name, i) })),
    cycles: [makeCycle(s.firstPayday, s.config)],
    events: [],
  }
}

/** Clearly fake numbers, so the game can be tried before real ones go in. */
export function demoGame(): GameData {
  const config = { ...DEFAULT_CONFIG }
  const nextPayday = nextWeekday(todayIso(), config.payday)
  const game = buildGame({
    players: [{ name: 'Demo Player 1' }, { name: 'Demo Player 2' }],
    config,
    firstPayday: addDays(nextPayday, -21),
    quests: [
      { name: 'DEMO Emergency Fund', targetAmount: 10000, targetDate: '2028-12-31', levelCount: 10, autopilotDeposit: 150 },
      { name: 'DEMO Family Trip', targetAmount: 5000, targetDate: '2027-06-30', levelCount: 10, autopilotDeposit: 75 },
    ],
    bosses: [
      { cardNickname: 'DEMO Visa Viper', last4: '0000', rate: 24.9, startingBalance: 2400, minPayment: 60, autopilotAttack: 140 },
      { cardNickname: 'DEMO Store Card Golem', last4: '1111', rate: 29.9, startingBalance: 1100, minPayment: 35, autopilotAttack: 65 },
      { cardNickname: 'DEMO Mastercard Kraken', last4: '2222', rate: 19.9, startingBalance: 5200, minPayment: 120, autopilotAttack: 0 },
    ],
    lanes: [
      { name: 'Kids', budgetPerCycle: 60 }, { name: 'Tools', budgetPerCycle: 50 },
      { name: 'Travel', budgetPerCycle: 40 }, { name: 'Everyday', budgetPerCycle: 150 }, { name: 'Rewards', budgetPerCycle: 20 },
    ],
  }, true)

  // Three finished weeks, then the current open cycle.
  let t = Date.now() - 1e7
  const push = (cycleId: string, e: Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>) =>
    game.events.push({ id: uid(), timestamp: t++, cycleId, ...e })
  let cycle = game.cycles[0]
  for (let i = 0; i < 3; i++) {
    const boss = game.bosses[0]
    push(cycle.id, { type: 'payment', bossId: boss.id, amount: 200 })
    push(cycle.id, { type: 'payment', bossId: game.bosses[2].id, amount: 120 })
    push(cycle.id, { type: 'interest', bossId: boss.id, amount: 38 - i * 4 })
    push(cycle.id, { type: 'interest', bossId: game.bosses[2].id, amount: 60 })
    game.quests.forEach(q => push(cycle.id, { type: 'deposit', questId: q.id, amount: q.autopilotDeposit }))
    game.lanes.forEach(l => push(cycle.id, { type: 'laneSpend', laneId: l.id, amount: Math.round(l.budgetPerCycle * (i === 1 ? 1.1 : 0.7)) }))
    push(cycle.id, { type: 'gameNight', amount: 0 })
    game.cycles.push(nextCycle(cycle, config))
    cycle = game.cycles[game.cycles.length - 1]
  }
  return game
}
