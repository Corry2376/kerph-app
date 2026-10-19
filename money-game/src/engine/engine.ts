import type {
  BossState, Config, CycleScore, EngineInput, EngineState, GameEvent, LaneState, LevelUp, QuestState, XpBreakdown,
} from './types'

const round2 = (n: number) => Math.round(n * 100) / 100
const emptyBreakdown = (): XpBreakdown => ({
  gameNight: 0, lanes: 0, sweep: 0, extraBoss: 0, noSpend: 0, bonusSplit: 0, levelUp: 0, bossDefeated: 0,
})

export function multiplierFor(config: Config, streak: number): number {
  let x = 1
  for (const m of [...config.streakMultipliers].sort((a, b) => a.min - b.min)) if (streak >= m.min) x = m.x
  return x
}

/**
 * Pure: event log + config in, XP / streaks / levels / boss health out. Nothing here touches
 * storage or the UI, so any season can be replayed from its log.
 */
export function computeState(input: EngineInput): EngineState {
  const { config, quests, bosses, lanes, cycles } = input
  const events = input.events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.timestamp - b.e.timestamp || a.i - b.i)
    .map(x => x.e)

  const cycleIds = new Set(cycles.map(c => c.id))
  const lastCycleId = cycles[cycles.length - 1]?.id
  const bd = new Map(cycles.map(c => [c.id, emptyBreakdown()]))
  const completed = new Set<string>()
  const laneSpent = new Map<string, Map<string, number>>() // cycle -> lane -> spent
  const laneSwept = new Map<string, Map<string, number>>()
  const bump = (m: Map<string, Map<string, number>>, cycle: string, lane: string, by: number) => {
    const inner = m.get(cycle) ?? new Map<string, number>()
    inner.set(lane, round2((inner.get(lane) ?? 0) + by))
    m.set(cycle, inner)
  }

  const bossState = new Map<string, BossState & { ever: boolean; paid: boolean }>(
    bosses.map(b => [b.id, {
      id: b.id, currentBalance: b.startingBalance, status: 'queued', hits: [], heals: [], ever: false, paid: false,
    }]),
  )
  const questState = new Map<string, QuestState>(quests.map(q => [q.id, {
    id: q.id, currentAmount: 0, levelSize: q.targetAmount / q.levelCount, levelsCleared: 0, complete: false,
  }]))
  const levelUps: LevelUp[] = []
  const bossDefeats: EngineState['bossDefeats'] = []

  const damage = (e: GameEvent, bossId: string, amount: number) => {
    const b = bossState.get(bossId)
    if (!b) throw new Error(`Unknown boss ${bossId}`)
    const applied = Math.min(amount, b.currentBalance)
    b.currentBalance = round2(b.currentBalance - applied)
    if (applied > 0) b.hits.push({ eventId: e.id, cycleId: e.cycleId, amount: applied })
    if (b.currentBalance === 0 && b.hits.length > 0) {
      b.ever = true
      if (!b.paid) {
        b.paid = true
        b.defeatedInCycle = e.cycleId
        bossDefeats.push({ cycleId: e.cycleId, bossId })
        bd.get(e.cycleId)!.bossDefeated += config.xp.bossDefeated
      }
    }
  }
  const deposit = (e: GameEvent, questId: string, amount: number) => {
    const q = questState.get(questId)
    if (!q) throw new Error(`Unknown quest ${questId}`)
    q.currentAmount = round2(q.currentAmount + amount)
    const target = quests.find(x => x.id === questId)!
    const levels = Math.min(target.levelCount, Math.floor((q.currentAmount + 1e-9) / q.levelSize))
    for (let l = q.levelsCleared + 1; l <= levels; l++) {
      levelUps.push({ cycleId: e.cycleId, questId, level: l })
      bd.get(e.cycleId)!.levelUp += config.xp.levelUp
    }
    q.levelsCleared = Math.max(q.levelsCleared, levels)
    q.complete = q.currentAmount >= target.targetAmount
  }

  for (const e of events) {
    if (!cycleIds.has(e.cycleId)) throw new Error(`Event ${e.id} references unknown cycle ${e.cycleId}`)
    const x = bd.get(e.cycleId)!
    switch (e.type) {
      case 'payment':
        damage(e, e.bossId!, e.amount)
        if (e.extra) x.extraBoss += Math.floor(e.amount / 10) * config.xp.extraBossPer10
        break
      case 'interest': {
        const b = bossState.get(e.bossId!)
        if (!b) throw new Error(`Unknown boss ${e.bossId}`)
        b.currentBalance = round2(b.currentBalance + e.amount)
        if (e.amount > 0) b.heals.push({ eventId: e.id, cycleId: e.cycleId, amount: e.amount })
        break
      }
      case 'deposit': deposit(e, e.questId!, e.amount); break
      case 'laneSpend': bump(laneSpent, e.cycleId, e.laneId!, e.amount); break
      case 'sweep':
        bump(laneSwept, e.cycleId, e.laneId!, e.amount)
        if (e.bossId) damage(e, e.bossId, e.amount)
        else deposit(e, e.questId!, e.amount)
        x.sweep += Math.floor(e.amount / 10) * config.xp.sweepPer10
        break
      case 'noSpendDay': x.noSpend += e.amount * config.xp.noSpendDay; break
      case 'windfall': if (e.followedSplit) x.bonusSplit += config.xp.bonusSplitFollowed; break
      case 'gameNight': completed.add(e.cycleId); break
    }
  }

  // Cycle scoring: streaks run oldest to newest; the cycle in progress never breaks one.
  let gnStreak = 0
  const laneStreaks = new Map<string, number>(lanes.map(l => [l.id, 0]))
  const scores: CycleScore[] = cycles.map(c => {
    const done = completed.has(c.id)
    const isLast = c.id === lastCycleId
    const x = bd.get(c.id)!
    if (done) {
      x.gameNight = config.xp.gameNight
      gnStreak += 1
    } else if (!isLast) gnStreak = 0
    for (const l of lanes) {
      const spent = laneSpent.get(c.id)?.get(l.id) ?? 0
      const under = done && spent < l.budgetPerCycle
      if (under) x.lanes += config.xp.laneUnderBudget
      if (done) laneStreaks.set(l.id, under ? laneStreaks.get(l.id)! + 1 : 0)
      else if (!isLast) laneStreaks.set(l.id, 0)
    }
    const base = Object.values(x).reduce((a, b) => a + b, 0)
    const multiplier = done ? multiplierFor(config, gnStreak) : 1
    return { cycleId: c.id, completed: done, base, breakdown: x, streak: gnStreak, multiplier, xp: Math.round(base * multiplier) }
  })

  // Queue: first boss that isn't defeated is the active one.
  const states = bosses.map(b => bossState.get(b.id)!)
  const active = states.find(s => s.currentBalance > 0) ?? null
  for (const s of states) {
    s.status = s.currentBalance === 0 && s.ever ? 'defeated' : s === active ? (s.ever ? 'rematch' : 'active') : s.ever && s.currentBalance > 0 ? 'rematch' : 'queued'
  }
  let attackPower = 0
  for (const b of bosses) {
    const s = bossState.get(b.id)!
    if (s.status === 'defeated' || s === active) attackPower += b.minPayment + b.autopilotAttack
  }

  const current = lastCycleId
  const laneStates: LaneState[] = lanes.map(l => {
    const spent = current ? laneSpent.get(current)?.get(l.id) ?? 0 : 0
    const swept = current ? laneSwept.get(current)?.get(l.id) ?? 0 : 0
    return { id: l.id, spent, swept, remaining: round2(Math.max(0, l.budgetPerCycle - spent - swept)), streak: laneStreaks.get(l.id)! }
  })

  return {
    bosses: states.map(({ ever: _e, paid: _p, ...s }) => s),
    activeBossId: active?.id ?? null,
    attackPower,
    quests: quests.map(q => questState.get(q.id)!),
    lanes: laneStates,
    cycles: scores,
    totalXp: scores.reduce((a, s) => a + s.xp, 0),
    gameNightStreak: gnStreak,
    multiplier: multiplierFor(config, gnStreak),
    nextMultiplier: multiplierFor(config, gnStreak + 1),
    levelUps,
    bossDefeats,
  }
}
