import { useGame } from '../store'
import { Btn, Card, H, ProgressBar, money } from '../components/ui'
import type { Tab } from '../App'

export default function HQ({ go }: { go: (t: Tab) => void }) {
  const { data, state, cycleId } = useGame()
  const cycle = data.cycles.find(c => c.id === cycleId)!
  const boss = data.bosses.find(b => b.id === state.activeBossId)
  const bossState = state.bosses.find(b => b.id === state.activeBossId)
  const debtLeft = state.bosses.reduce((a, b) => a + b.currentBalance, 0)
  const debtStart = data.bosses.reduce((a, b) => a + b.startingBalance, 0)

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between">
          <H>Team score</H>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{state.totalXp.toLocaleString()} XP</span>
        </div>
        <p className="text-sm">
          🔥 <b>{state.gameNightStreak}</b> week streak · multiplier <b>{state.multiplier}x</b>
          {state.nextMultiplier > state.multiplier && <span className="text-slate-500"> (next: {state.nextMultiplier}x)</span>}
        </p>
        <p className="mt-1 text-xs text-slate-500">Cycle {cycle.startDate} to {cycle.endDate}</p>
      </Card>

      <Card>
        <H>{boss ? `Boss: ${boss.cardNickname}` : 'All bosses defeated'}</H>
        {boss && bossState ? (
          <>
            <ProgressBar value={bossState.currentBalance} max={boss.startingBalance} color="#ef4444" label="Boss health" />
            <p className="mt-2 text-sm"><b>{money(bossState.currentBalance)}</b> left of {money(boss.startingBalance)} · attack {money(state.attackPower)}/cycle</p>
          </>
        ) : <p>Every card is paid off. Time to celebrate.</p>}
        <p className="mt-2 text-xs text-slate-500">All cards: {money(debtLeft)} left of {money(debtStart)}</p>
      </Card>

      <Card>
        <H>Quests</H>
        <ul className="space-y-3">
          {data.quests.map(q => {
            const qs = state.quests.find(x => x.id === q.id)!
            return (
              <li key={q.id}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{q.name}</span><span>Level {qs.levelsCleared}/{q.levelCount}</span></div>
                <ProgressBar value={qs.currentAmount} max={q.targetAmount} color="#10b981" label={q.name} />
                <p className="text-xs text-slate-500">{money(qs.currentAmount)} of {money(q.targetAmount)} by {q.targetDate}</p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Btn className="w-full py-4 text-lg" onClick={() => go('night')}>🎲 Start game night</Btn>
    </>
  )
}
