import { fmtMoney } from './format'
import { ACHIEVEMENTS } from './achievements'
import type { Picker } from './messages'
import type { EngineInput, EngineState, GameEvent, XpBreakdown } from './types'

export type MomentKind =
  | 'bossHit' | 'bossHeal' | 'bossDefeated' | 'levelUp' | 'laneUnder' | 'sweep' | 'extraDamage'
  | 'noSpendDay' | 'planClosed' | 'bonusSplit' | 'streakMilestone' | 'missedWeek' | 'achievement' | 'gameNight'

/** One thing worth reacting to at the end of a game night. */
export interface Moment {
  kind: MomentKind
  label: string
  message: string
  amount?: number
  bossId?: string
  questId?: string
  level?: number
  hpBefore?: number
  hpAfter?: number
  hpMax?: number
  achievementKey?: string
  /** Lane name for laneUnder moments, so several can be shown on one screen. */
  subject?: string
  streak?: number
  multiplier?: number
  xp?: number
  breakdown?: XpBreakdown
}

export interface MomentArgs {
  /** Game data with the new events already included. */
  input: EngineInput
  before: EngineState
  after: EngineState
  cycleId: string
  newEvents: GameEvent[]
  achievementsBefore: string[]
  achievementsAfter: string[]
  pick: Picker
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function deriveMoments(a: MomentArgs): Moment[] {
  const { input, before, after, cycleId, newEvents, pick } = a
  const bossName = (id: string) => input.bosses.find(b => b.id === id)?.cardNickname ?? 'the boss'
  const questName = (id: string) => input.quests.find(q => q.id === id)?.name ?? 'your quest'
  const newIds = new Set(newEvents.map(e => e.id))
  const idx = after.cycles.findIndex(c => c.cycleId === cycleId)
  const score = after.cycles[idx]
  const out: Moment[] = []

  const beforeBoss = (id: string) => before.bosses.find(b => b.id === id)!.currentBalance
  const hits: Moment[] = []
  const heals: Moment[] = []
  const defeats: Moment[] = []
  for (const b of input.bosses) {
    const s = after.bosses.find(x => x.id === b.id)!
    const dmg = round2(s.hits.filter(h => newIds.has(h.eventId)).reduce((t, h) => t + h.amount, 0))
    const heal = round2(s.heals.filter(h => newIds.has(h.eventId)).reduce((t, h) => t + h.amount, 0))
    const afterHit = Math.max(0, round2(beforeBoss(b.id) - dmg))
    if (dmg > 0) hits.push({
      kind: 'bossHit', label: 'Payment', amount: dmg, bossId: b.id, hpBefore: beforeBoss(b.id), hpAfter: afterHit, hpMax: b.startingBalance,
      message: pick('bossHit', { amount: fmtMoney(dmg), boss: b.cardNickname, hp: fmtMoney(afterHit) }),
    })
    if (heal > 0) heals.push({
      kind: 'bossHeal', label: 'Interest charged', amount: heal, bossId: b.id, hpBefore: afterHit, hpAfter: s.currentBalance, hpMax: b.startingBalance,
      message: pick('bossHeal', { boss: b.cardNickname, interest: fmtMoney(heal) }),
    })
    if (after.bossDefeats.some(d => d.cycleId === cycleId && d.bossId === b.id)) {
      const next = after.activeBossId ? bossName(after.activeBossId) : 'whatever comes next'
      defeats.push({
        kind: 'bossDefeated', label: 'Paid off', bossId: b.id, hpBefore: 0, hpAfter: 0, hpMax: b.startingBalance,
        message: pick('bossDefeated', { boss: b.cardNickname, payment: fmtMoney(b.minPayment + b.autopilotAttack), nextBoss: next }),
      })
    }
  }
  out.push(...hits)

  const extra = newEvents.filter(e => e.type === 'payment' && e.extra)
  if (extra.length) {
    const total = round2(extra.reduce((t, e) => t + e.amount, 0))
    const top = extra.reduce((m, e) => (e.amount > m.amount ? e : m))
    out.push({ kind: 'extraDamage', label: 'Extra payment', amount: total, bossId: top.bossId,
      message: pick('extraDamage', { amount: fmtMoney(total), boss: bossName(top.bossId!) }) })
  }
  out.push(...heals, ...defeats)

  for (const l of after.levelUps.filter(l => l.cycleId === cycleId)) {
    const q = input.quests.find(x => x.id === l.questId)!
    const remaining = Math.max(0, round2(q.targetAmount - l.level * (q.targetAmount / q.levelCount)))
    out.push({ kind: 'levelUp', label: 'Milestone', questId: l.questId, level: l.level,
      message: pick('levelUp', { level: l.level, quest: q.name, remaining: fmtMoney(remaining) }) })
  }

  if (score?.completed) {
    const spent = new Map<string, number>()
    for (const e of input.events) if (e.cycleId === cycleId && e.type === 'laneSpend') spent.set(e.laneId!, (spent.get(e.laneId!) ?? 0) + e.amount)
    for (const l of input.lanes) {
      const left = round2(l.budgetPerCycle - (spent.get(l.id) ?? 0))
      if (left > 0) out.push({ kind: 'laneUnder', label: 'Under budget', amount: left, subject: l.name,
        message: pick('laneUnder', { lane: l.name, amount: fmtMoney(left) }) })
    }
  }

  const sweeps = newEvents.filter(e => e.type === 'sweep')
  if (sweeps.length) {
    const total = round2(sweeps.reduce((t, e) => t + e.amount, 0))
    const dests = [...new Set(sweeps.map(e => (e.bossId ? bossName(e.bossId) : questName(e.questId!))))]
    out.push({ kind: 'sweep', label: 'Allocated', amount: total,
      message: pick('sweep', { amount: fmtMoney(total), dest: dests.length <= 2 ? dests.join(' and ') : 'your goals' }) })
  }

  const nsd = newEvents.filter(e => e.type === 'noSpendDay').reduce((t, e) => t + e.amount, 0)
  if (nsd > 0) out.push({ kind: 'noSpendDay', label: 'No-spend days', amount: nsd,
    message: pick('noSpendDay', { days: `${nsd} no-spend day${nsd === 1 ? '' : 's'}` }) })

  const wind = newEvents.filter(e => e.type === 'windfall' && e.followedSplit)
  if (wind.length) {
    const total = round2(wind.reduce((t, e) => t + e.amount, 0))
    out.push({ kind: 'bonusSplit', label: 'Windfall', amount: total, message: pick('bonusSplit', { amount: fmtMoney(total) }) })
  }

  for (const ps of after.plans.filter(p => p.closed && p.closedCycleId === cycleId && newEvents.some(e => e.type === 'planClose' && e.planId === p.id))) {
    const plan = input.plans?.find(p => p.id === ps.id)
    if (!plan || ps.spent > plan.budget) continue
    const under = round2(plan.budget - ps.spent)
    out.push({ kind: 'planClosed', label: 'Event closed', subject: plan.name, amount: under,
      message: pick('planClosed', { plan: plan.name, result: under > 0 ? `${fmtMoney(under)} under budget` : 'exactly on budget' }) })
  }

  if (score?.completed && score.multiplier > before.multiplier) {
    out.push({ kind: 'streakMilestone', label: 'Streak', streak: score.streak, multiplier: score.multiplier,
      message: pick('streakMilestone', { streak: score.streak, multiplier: score.multiplier }) })
  }
  if (score?.completed && idx > 0 && !after.cycles[idx - 1].completed) {
    out.push({ kind: 'missedWeek', label: 'Back on track', message: pick('missedWeek', { xp: after.totalXp.toLocaleString('en-US') }) })
  }

  for (const key of a.achievementsAfter.filter(k => !a.achievementsBefore.includes(k))) {
    const def = ACHIEVEMENTS.find(d => d.key === key)
    if (def) out.push({ kind: 'achievement', label: 'Achievement', achievementKey: key, message: pick('achievement', { name: def.name }) })
  }

  if (score) out.push({
    kind: 'gameNight', label: 'Review', xp: score.xp, streak: score.streak, multiplier: score.multiplier, breakdown: score.breakdown,
    message: pick('gameNight', { streak: score.streak, multiplier: score.multiplier, xp: score.xp }),
  })
  return out
}
