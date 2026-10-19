export interface Player { id: string; name: string; avatar: string }

export interface Quest {
  id: string
  name: string
  targetAmount: number
  targetDate: string
  levelCount: number
  autopilotDeposit: number
  order: number
  status: 'active' | 'paused'
}

export interface Boss {
  id: string
  cardNickname: string
  last4: string
  rate: number
  startingBalance: number
  minPayment: number
  /** Autopilot attack beyond the minimum payment. */
  autopilotAttack: number
  artSeed: number
}

export interface Lane { id: string; name: string; budgetPerCycle: number; color: string; icon: string }

/** A budgeted event in a given month: Christmas, a birthday, a trip. */
export interface Plan { id: string; name: string; month: string; budget: number; yearly: boolean }

export interface Cycle { id: string; startDate: string; endDate: string; payday: string }

export type EventType =
  | 'payment'
  | 'interest'
  | 'deposit'
  | 'laneSpend'
  | 'sweep'
  | 'windfall'
  | 'noSpendDay'
  | 'planFund'
  | 'planSpend'
  | 'planClose'
  | 'gameNight'

/**
 * Only things the players do are stored. Level-ups, boss defeats, streaks and XP are derived
 * by the engine so the whole game can be replayed from the log.
 */
export interface GameEvent {
  id: string
  timestamp: number
  cycleId: string
  type: EventType
  /** Dollars; for noSpendDay it is the number of days. */
  amount: number
  bossId?: string
  questId?: string
  laneId?: string
  planId?: string
  playerId?: string
  /** payment: damage beyond autopilot (earns extra-damage XP). */
  extra?: boolean
  /** windfall: the agreed split was followed. */
  followedSplit?: boolean
}

export interface XpConfig {
  gameNight: number
  laneUnderBudget: number
  sweepPer10: number
  extraBossPer10: number
  levelUp: number
  bossDefeated: number
  noSpendDay: number
  bonusSplitFollowed: number
  /** Closing a planned event at or under its budget. */
  planUnderBudget: number
}

export interface Config {
  payCycle: 'weekly' | 'biweekly'
  payday: string
  bossOrder: 'snowball' | 'avalanche'
  levelsPerQuest: number
  xp: XpConfig
  streakMultipliers: { min: number; x: number }[]
  bonusSplit: { boss: number; quests: number; fun: number }
  legendMargin: number
}

export interface EngineInput {
  config: Config
  quests: Quest[]
  /** Array order is the boss queue. */
  bosses: Boss[]
  lanes: Lane[]
  plans?: Plan[]
  /** Chronological. The last cycle is the one in progress. */
  cycles: Cycle[]
  events: GameEvent[]
}

export interface BossHit { eventId: string; cycleId: string; amount: number }

export interface BossState {
  id: string
  currentBalance: number
  status: 'queued' | 'active' | 'defeated' | 'rematch'
  hits: BossHit[]
  heals: BossHit[]
  defeatedInCycle?: string
}

export interface QuestState {
  id: string
  currentAmount: number
  levelSize: number
  levelsCleared: number
  complete: boolean
}

export interface LaneState {
  id: string
  spent: number
  remaining: number
  swept: number
  /** Consecutive completed cycles finished under budget. */
  streak: number
}

export interface PlanState {
  id: string
  /** Set aside so far. */
  funded: number
  spent: number
  closed: boolean
  closedCycleId?: string
}

export interface LevelUp { cycleId: string; questId: string; level: number }

export interface XpBreakdown {
  gameNight: number
  lanes: number
  sweep: number
  extraBoss: number
  noSpend: number
  bonusSplit: number
  plans: number
  levelUp: number
  bossDefeated: number
}

export interface CycleScore {
  cycleId: string
  completed: boolean
  /** Lanes that finished under budget (only counted once the game night is done). */
  lanesUnder: number
  base: number
  breakdown: XpBreakdown
  /** Game-night streak after this cycle. */
  streak: number
  multiplier: number
  xp: number
}

export interface EngineState {
  bosses: BossState[]
  activeBossId: string | null
  /** Dollars per cycle aimed at the active boss: its own payments plus every defeated boss's. */
  attackPower: number
  quests: QuestState[]
  /** Lane totals for the cycle in progress. */
  lanes: LaneState[]
  cycles: CycleScore[]
  totalXp: number
  gameNightStreak: number
  multiplier: number
  /** Multiplier the next completed game night would earn. */
  nextMultiplier: number
  plans: PlanState[]
  levelUps: LevelUp[]
  bossDefeats: { cycleId: string; bossId: string }[]
}
