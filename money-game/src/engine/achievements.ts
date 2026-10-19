import type { EngineInput, EngineState } from './types'

export interface AchievementDef { key: string; name: string; description: string; needsSeasons?: boolean }

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'firstBlood', name: 'First Blood', description: 'Log your first payment against a boss.' },
  { key: 'bossSlayer', name: 'Boss Slayer', description: 'Defeat your first boss.' },
  { key: 'ironStreak', name: 'Iron Streak', description: 'Hold a 10-cycle game-night streak.' },
  { key: 'cleanSweep', name: 'Clean Sweep', description: 'Finish every lane under budget in one cycle.' },
  { key: 'levelUp', name: 'Level Up', description: 'Clear your first quest level.' },
  { key: 'comebackKid', name: 'Comeback Kid', description: 'Complete a game night after a broken streak.' },
  { key: 'seasonChamp', name: 'Season Champ', description: 'Beat a season target.', needsSeasons: true },
  { key: 'windfallWizard', name: 'Windfall Wizard', description: 'Handle a windfall exactly per the agreed split.' },
]

/** Derived from the log: which achievements are unlocked, and in which cycle. */
export function computeAchievements(input: EngineInput, state: EngineState): Record<string, string> {
  const out: Record<string, string> = {}
  const events = [...input.events].sort((a, b) => a.timestamp - b.timestamp)

  const blood = events.find(e => (e.type === 'payment' || e.type === 'sweep') && e.bossId)
  if (blood) out.firstBlood = blood.cycleId
  if (state.bossDefeats[0]) out.bossSlayer = state.bossDefeats[0].cycleId
  if (state.levelUps[0]) out.levelUp = state.levelUps[0].cycleId
  const wiz = events.find(e => e.type === 'windfall' && e.followedSplit)
  if (wiz) out.windfallWizard = wiz.cycleId

  const iron = state.cycles.find(c => c.completed && c.streak >= 10)
  if (iron) out.ironStreak = iron.cycleId
  if (input.lanes.length > 0) {
    const clean = state.cycles.find(c => c.completed && c.lanesUnder === input.lanes.length)
    if (clean) out.cleanSweep = clean.cycleId
  }
  const comeback = state.cycles.find((c, i) => c.completed && i > 0 && !state.cycles[i - 1].completed && state.cycles.slice(0, i - 1).some(p => p.completed))
  if (comeback) out.comebackKid = comeback.cycleId
  return out
}
