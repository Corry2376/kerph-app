import type { EngineInput, EngineState } from './types'

export interface LifetimeStats {
  careerXp: number
  bossesDefeated: number
  levelsCleared: number
  longestStreak: number
  gameNights: number
  totalSwept: number
  totalDamage: number
}

export function lifetimeStats(input: EngineInput, state: EngineState): LifetimeStats {
  return {
    careerXp: state.totalXp,
    bossesDefeated: state.bossDefeats.length,
    levelsCleared: state.levelUps.length,
    longestStreak: Math.max(0, ...state.cycles.map(c => c.streak)),
    gameNights: state.cycles.filter(c => c.completed).length,
    totalSwept: Math.round(input.events.filter(e => e.type === 'sweep').reduce((a, e) => a + e.amount, 0) * 100) / 100,
    totalDamage: Math.round(state.bosses.flatMap(b => b.hits).reduce((a, h) => a + h.amount, 0) * 100) / 100,
  }
}
