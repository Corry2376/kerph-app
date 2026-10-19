import { useGame } from '../store'
import { Btn, Card, H, ProgressBar, money } from '../components/ui'
import { Icon } from '../components/Icon'
import { monthLabel, suggestedSetAside } from '../engine/plans'
import { cycleLength } from '../data/model'
import type { Tab } from '../App'

export default function HQ({ go }: { go: (t: Tab) => void }) {
  const { data, state, cycleId } = useGame()
  const cycle = data.cycles.find(c => c.id === cycleId)!
  const boss = data.bosses.find(b => b.id === state.activeBossId)
  const bossState = state.bosses.find(b => b.id === state.activeBossId)
  const debtLeft = state.bosses.reduce((a, b) => a + b.currentBalance, 0)
  const debtStart = data.bosses.reduce((a, b) => a + b.startingBalance, 0)
  const upcoming = data.plans.filter(p => !state.plans.find(s => s.id === p.id)!.closed).sort((a, b) => a.month.localeCompare(b.month)).slice(0, 3)

  return (
    <>
      <Card>
        <div className="flex items-baseline justify-between">
          <H>Score</H>
          <span className="font-serif text-2xl font-bold text-amber-700 dark:text-amber-400">{state.totalXp.toLocaleString()} pts</span>
        </div>
        <p className="text-sm">
          <Icon name="flame" size={16} className="mr-1 inline text-amber-600" /><b>{state.gameNightStreak}</b> week streak · bonus <b>{state.multiplier}x</b>
          {state.nextMultiplier > state.multiplier && <span className="text-zinc-500"> (next: {state.nextMultiplier}x)</span>}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Cycle {cycle.startDate} to {cycle.endDate}</p>
      </Card>

      <Card>
        <H>{boss ? `Paying down: ${boss.cardNickname}` : 'All cards paid off'}</H>
        {boss && bossState ? (
          <>
            <ProgressBar value={bossState.currentBalance} max={boss.startingBalance} color="#a8514a" label="Remaining balance" />
            <p className="mt-2 text-sm"><b>{money(bossState.currentBalance)}</b> left of {money(boss.startingBalance)} · paying {money(state.attackPower)} per cycle</p>
          </>
        ) : <p className="text-sm">Every card is at zero.</p>}
        <p className="mt-2 text-xs text-zinc-500">All cards: {money(debtLeft)} left of {money(debtStart)}</p>
      </Card>

      <Card>
        <H>Goals</H>
        <ul className="space-y-3">
          {data.quests.map(q => {
            const qs = state.quests.find(x => x.id === q.id)!
            return (
              <li key={q.id}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{q.name}</span><span>Milestone {qs.levelsCleared}/{q.levelCount}</span></div>
                <ProgressBar value={qs.currentAmount} max={q.targetAmount} color="#5f8a6e" label={q.name} />
                <p className="text-xs text-zinc-500">{money(qs.currentAmount)} of {money(q.targetAmount)} by {q.targetDate}</p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between"><H>Coming up</H>
          <button className="text-xs text-amber-700 underline dark:text-amber-400" onClick={() => go('lanes')}>All events</button></div>
        {upcoming.length === 0 && <p className="text-sm text-zinc-500">No events planned yet.</p>}
        <ul className="space-y-3">
          {upcoming.map(p => {
            const ps = state.plans.find(s => s.id === p.id)!
            const need = suggestedSetAside(p, ps.funded, cycle.payday, cycleLength(data.config))
            return (
              <li key={p.id}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{p.name} <span className="font-normal text-zinc-500">{monthLabel(p.month)}</span></span><span>{money(ps.funded)} / {money(p.budget)}</span></div>
                <ProgressBar value={ps.funded} max={p.budget} color="#c8963e" label={`${p.name} funded`} height={8} />
                <p className="text-xs text-zinc-500">{need > 0 ? `Set aside ${money(need)} this cycle to stay on schedule` : 'Fully funded'}</p>
              </li>
            )
          })}
        </ul>
      </Card>

      <Btn className="w-full py-4 text-base" onClick={() => go('night')}>Start weekly review</Btn>
    </>
  )
}
