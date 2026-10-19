import { pickMessage } from '../engine/messages'
import { fmtMoney } from '../engine/format'
import type { Moment } from '../engine/moments'
import type { GameData } from '../data/model'
import type { EngineState } from '../engine/types'

/** Synthetic reel using the current game's real names, so every effect can be previewed without playing a week. */
export function sampleMoments(data: GameData, state: EngineState): Moment[] {
  const boss = data.bosses.find(b => b.id === state.activeBossId) ?? data.bosses[0]
  const next = data.bosses.find(b => b.id !== boss.id)
  const quest = data.quests[0]
  const lane = data.lanes[0]
  const hp = Math.max(boss.startingBalance * 0.6, 500)
  const p = pickMessage
  const out: Moment[] = [
    { kind: 'bossHit', label: 'Boss hit', amount: 340, bossId: boss.id, hpBefore: hp, hpAfter: hp - 340, hpMax: boss.startingBalance,
      message: p('bossHit', { amount: fmtMoney(340), boss: boss.cardNickname, hp: fmtMoney(hp - 340) }) },
    { kind: 'bossHeal', label: 'Boss heals', amount: 38, bossId: boss.id, hpBefore: hp - 340, hpAfter: hp - 302, hpMax: boss.startingBalance,
      message: p('bossHeal', { boss: boss.cardNickname, interest: fmtMoney(38) }) },
    { kind: 'extraDamage', label: 'Extra damage', amount: 60, bossId: boss.id, message: p('extraDamage', { amount: fmtMoney(60), boss: boss.cardNickname }) },
    ...(lane ? [{ kind: 'laneUnder' as const, label: 'Lane under budget', amount: 22, message: p('laneUnder', { lane: lane.name, amount: fmtMoney(22) }) }] : []),
    { kind: 'sweep', label: 'Swept', amount: 42, message: p('sweep', { amount: fmtMoney(42), dest: boss.cardNickname }) },
    { kind: 'noSpendDay', label: 'No-spend days', amount: 2, message: p('noSpendDay', { days: '2 no-spend days' }) },
    { kind: 'bonusSplit', label: 'Bonus round', amount: 300, message: p('bonusSplit', { amount: fmtMoney(300) }) },
    ...(quest ? [{ kind: 'levelUp' as const, label: 'Level up', questId: quest.id, level: 3,
      message: p('levelUp', { level: 3, quest: quest.name, remaining: fmtMoney(quest.targetAmount * 0.7) }) }] : []),
    { kind: 'streakMilestone', label: 'Streak', streak: 6, multiplier: 1.5, message: p('streakMilestone', { streak: 6, multiplier: 1.5 }) },
    { kind: 'missedWeek', label: 'Comeback', message: p('missedWeek', { xp: state.totalXp.toLocaleString('en-US') }) },
    { kind: 'bossDefeated', label: 'Boss defeated', bossId: boss.id, hpBefore: 0, hpAfter: 0, hpMax: boss.startingBalance,
      message: p('bossDefeated', { boss: boss.cardNickname, payment: fmtMoney(boss.minPayment + boss.autopilotAttack), nextBoss: next?.cardNickname ?? 'the next card' }) },
    { kind: 'achievement', label: 'Achievement', achievementKey: 'bossSlayer', message: p('achievement', { name: 'Boss Slayer' }) },
    { kind: 'gameNight', label: 'Game night', xp: 640, streak: 6, multiplier: 1.5,
      breakdown: { gameNight: 50, lanes: 100, sweep: 4, extraBoss: 12, noSpend: 20, bonusSplit: 100, levelUp: 200, bossDefeated: 1000 },
      message: p('gameNight', { streak: 6, multiplier: 1.5, xp: 640 }) },
  ]
  return out
}
