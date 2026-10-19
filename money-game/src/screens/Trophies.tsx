import { useMemo } from 'react'
import { useGame } from '../store'
import { ACHIEVEMENTS, computeAchievements } from '../engine/achievements'
import { lifetimeStats } from '../engine/stats'
import { BossArt } from '../components/BossArt'
import { Icon } from '../components/Icon'
import { Card, H, money } from '../components/ui'

export default function Trophies() {
  const { data, state } = useGame()
  const unlocked = useMemo(() => computeAchievements(data, state), [data, state])
  const stats = useMemo(() => lifetimeStats(data, state), [data, state])
  const when = (cycleId: string) => data.cycles.find(c => c.id === cycleId)?.payday ?? cycleId
  const defeated = state.bosses.filter(b => b.status === 'defeated')

  const rows: [string, string][] = [
    ['Career XP', stats.careerXp.toLocaleString('en-US')],
    ['Bosses defeated', String(stats.bossesDefeated)],
    ['Total damage dealt', money(stats.totalDamage)],
    ['Total swept', money(stats.totalSwept)],
    ['Quest levels cleared', String(stats.levelsCleared)],
    ['Game nights played', String(stats.gameNights)],
    ['Longest streak', `${stats.longestStreak} weeks`],
  ]

  return (
    <>
      <Card>
        <H>Achievements · {Object.keys(unlocked).length} / {ACHIEVEMENTS.length}</H>
        <ul className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map(a => {
            const got = unlocked[a.key]
            return (
              <li key={a.key} className={`rounded-md border p-3 ${got ? 'border-amber-500/60 bg-amber-500/5' : 'border-stone-200 opacity-60 dark:border-zinc-800'}`}>
                <div className={`mb-2 flex size-9 items-center justify-center rounded-full border ${got ? 'border-amber-500 text-amber-500' : 'border-stone-300 text-stone-400 dark:border-zinc-700'}`}>
                  <Icon name={got ? 'trophy' : 'lock'} size={18} />
                </div>
                <p className="text-sm font-semibold">{a.name}</p>
                <p className="text-xs text-zinc-500">{a.description}</p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{got ? `Unlocked ${when(got)}` : a.needsSeasons ? 'Arrives with seasons' : 'Locked'}</p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <H>Defeated bosses</H>
        {defeated.length === 0 && <p className="text-sm text-zinc-500">No bosses down yet. The first one earns a place here.</p>}
        <ul className="grid grid-cols-3 gap-3">
          {defeated.map(s => {
            const b = data.bosses.find(x => x.id === s.id)!
            return (
              <li key={s.id} className="text-center">
                <div className="opacity-60 grayscale"><BossArt seed={b.artSeed} size={84} label={b.cardNickname} /></div>
                <p className="truncate text-xs font-semibold">{b.cardNickname}</p>
                <p className="text-xs text-zinc-500">{s.defeatedInCycle ? when(s.defeatedInCycle) : ''}</p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <H>Lifetime stats</H>
        <dl className="text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-stone-100 py-1.5 last:border-0 dark:border-zinc-800"><dt className="text-zinc-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
        </dl>
      </Card>

      <Card>
        <H>Past seasons</H>
        <p className="text-sm text-zinc-500">Season results will be recorded here once seasons arrive in the next phase.</p>
      </Card>
    </>
  )
}
