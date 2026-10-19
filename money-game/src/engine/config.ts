import type { Boss, Config } from './types'

export const DEFAULT_CONFIG: Config = {
  payCycle: 'weekly',
  payday: 'friday',
  bossOrder: 'snowball',
  levelsPerQuest: 10,
  xp: {
    gameNight: 50,
    laneUnderBudget: 25,
    sweepPer10: 1,
    extraBossPer10: 2,
    levelUp: 200,
    bossDefeated: 1000,
    noSpendDay: 10,
    bonusSplitFollowed: 100,
    planUnderBudget: 50,
  },
  streakMultipliers: [
    { min: 3, x: 1.25 },
    { min: 6, x: 1.5 },
    { min: 10, x: 2 },
  ],
  bonusSplit: { boss: 0.5, quests: 0.3, fun: 0.2 },
  legendMargin: 0.25,
}

export function sortBossQueue(bosses: Boss[], order: Config['bossOrder']): Boss[] {
  const key = order === 'snowball' ? (b: Boss) => b.startingBalance : (b: Boss) => -b.rate
  return [...bosses].sort((a, b) => key(a) - key(b))
}
