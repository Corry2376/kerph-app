import { useMemo, useState } from 'react'
import { useGame } from '../store'
import { computeState } from '../engine/engine'
import type { GameEvent } from '../engine/types'
import { computeAchievements } from '../engine/achievements'
import { deriveMoments, type Moment } from '../engine/moments'
import { pickMessage } from '../engine/messages'
import { monthLabel, suggestedSetAside } from '../engine/plans'
import { cycleLength, uid } from '../data/model'
import { Btn, Card, H, LaneMark, ProgressBar, money, num } from '../components/ui'
import Celebration from './Celebration'
import type { Tab } from '../App'

const STEPS = ['Autopilot', 'Balances', 'Budgets', 'Events', 'Allocate', 'Extras', 'Summary'] as const
type Draft = Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>
const round2 = (n: number) => Math.round(n * 100) / 100

export default function Review({ go }: { go: (t: Tab) => void }) {
  const { data, state, cycleId, commitGameNight } = useGame()
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [moments, setMoments] = useState<Moment[] | null>(null)
  const cycle = data.cycles.find(c => c.id === cycleId)!
  const openPlans = data.plans.filter(p => !state.plans.find(s => s.id === p.id)!.closed).sort((a, b) => a.month.localeCompare(b.month))

  // Defaults: what autopilot should have done, and what each event needs this cycle.
  const [pay, setPay] = useState<Record<string, string>>(() => Object.fromEntries(
    data.bosses.flatMap(b => {
      const s = state.bosses.find(x => x.id === b.id)!
      if (s.status === 'defeated') return []
      const planned = b.id === state.activeBossId ? state.attackPower : b.minPayment
      return [[b.id, String(Math.min(planned, s.currentBalance))]]
    })))
  const [dep, setDep] = useState<Record<string, string>>(() => Object.fromEntries(
    data.quests.filter(q => q.status === 'active').map(q => [q.id, String(q.autopilotDeposit)])))
  const [fund, setFund] = useState<Record<string, string>>(() => Object.fromEntries(
    openPlans.map(p => [p.id, String(suggestedSetAside(p, state.plans.find(s => s.id === p.id)!.funded, cycle.payday, cycleLength(data.config)))])))
  const [planSpend, setPlanSpend] = useState<Record<string, string>>({})
  const [bal, setBal] = useState<Record<string, string>>({})
  const [spend, setSpend] = useState<Record<string, string>>({})
  const [sweepAmt, setSweepAmt] = useState<Record<string, string>>({})
  const [sweepTo, setSweepTo] = useState<Record<string, string>>({})
  const [noSpend, setNoSpend] = useState('0')
  const [windfall, setWindfall] = useState('')
  const [split, setSplit] = useState(true)

  const { draft, stages } = useMemo(() => {
    const at = (events: Draft[]) => computeState({
      ...data,
      events: [...data.events, ...events.map((e, i) => ({ ...e, id: `d${i}`, timestamp: Date.now() + i, cycleId }))],
    })
    const a: Draft[] = [
      ...Object.entries(pay).filter(([, v]) => num(v) > 0).map(([bossId, v]): Draft => ({ type: 'payment', bossId, amount: num(v) })),
      ...Object.entries(dep).filter(([, v]) => num(v) > 0).map(([questId, v]): Draft => ({ type: 'deposit', questId, amount: num(v) })),
    ]
    const afterA = at(a)

    const b: Draft[] = data.bosses.flatMap((boss): Draft[] => {
      if (!(boss.id in bal) || bal[boss.id].trim() === '') return []
      const expected = afterA.bosses.find(s => s.id === boss.id)!.currentBalance
      const diff = round2(num(bal[boss.id]) - expected)
      if (diff > 0) return [{ type: 'interest', bossId: boss.id, amount: diff }]
      if (diff < 0) return [{ type: 'payment', bossId: boss.id, amount: -diff, extra: true }]
      return []
    })
    const afterB = at([...a, ...b])

    const c: Draft[] = []
    const sweeps: Draft[] = []
    const bossLeft = new Map(afterB.bosses.map(s => [s.id, s.currentBalance]))
    for (const l of data.lanes) {
      const logged = state.lanes.find(x => x.id === l.id)!
      const total = Math.max(logged.spent, num(spend[l.id] ?? String(logged.spent)))
      if (total > logged.spent) c.push({ type: 'laneSpend', laneId: l.id, amount: round2(total - logged.spent) })
      const remaining = Math.max(0, round2(l.budgetPerCycle - total - logged.swept))
      const dest = sweepTo[l.id] ?? (state.activeBossId ? `boss:${state.activeBossId}` : '')
      let amt = Math.min(remaining, sweepAmt[l.id] !== undefined ? num(sweepAmt[l.id]) : remaining)
      if (dest.startsWith('boss:')) {
        const id = dest.slice(5)
        amt = Math.min(amt, bossLeft.get(id) ?? 0)
        bossLeft.set(id, round2((bossLeft.get(id) ?? 0) - amt))
      }
      amt = round2(amt)
      if (amt > 0 && dest) sweeps.push(dest.startsWith('boss:')
        ? { type: 'sweep', laneId: l.id, bossId: dest.slice(5), amount: amt }
        : { type: 'sweep', laneId: l.id, questId: dest.slice(6), amount: amt })
    }

    const p: Draft[] = openPlans.flatMap((plan): Draft[] => [
      ...(num(fund[plan.id]) > 0 ? [{ type: 'planFund', planId: plan.id, amount: num(fund[plan.id]) } as Draft] : []),
      ...(num(planSpend[plan.id]) > 0 ? [{ type: 'planSpend', planId: plan.id, amount: num(planSpend[plan.id]) } as Draft] : []),
    ])

    const e: Draft[] = []
    if (num(noSpend) > 0) e.push({ type: 'noSpendDay', amount: Math.floor(num(noSpend)) })
    const w = num(windfall)
    if (w > 0) {
      e.push({ type: 'windfall', amount: w, followedSplit: split })
      if (split) {
        const boss = afterB.activeBossId
        const quest = data.quests.find(q => q.status === 'active')
        const s = data.config.bonusSplit
        if (boss) e.push({ type: 'payment', bossId: boss, amount: round2(w * s.boss) })
        if (quest) e.push({ type: 'deposit', questId: quest.id, amount: round2(w * s.quests) })
      }
    }
    const events = [...a, ...b, ...c, ...p, ...sweeps, ...e, { type: 'gameNight', amount: 0 } as Draft]
    return { draft: events, stages: { afterA, afterB } }
  }, [data, state, cycleId, openPlans, pay, dep, fund, planSpend, bal, spend, sweepAmt, sweepTo, noSpend, windfall, split])

  const finalState = useMemo(() => computeState({
    ...data, events: [...data.events, ...draft.map((e, i) => ({ ...e, id: `d${i}`, timestamp: Date.now() + i, cycleId }))],
  }), [data, draft, cycleId])

  const commit = () => {
    const t = Date.now()
    const events: GameEvent[] = draft.map((e, i) => ({ ...e, id: uid(), timestamp: t + i, cycleId }))
    const after = { ...data, events: [...data.events, ...events] }
    const afterState = computeState(after)
    setMoments(deriveMoments({
      input: after, before: state, after: afterState, cycleId, newEvents: events,
      achievementsBefore: Object.keys(computeAchievements(data, state)),
      achievementsAfter: Object.keys(computeAchievements(after, afterState)),
      pick: pickMessage,
    }))
    commitGameNight(events)
  }

  const name = (id: string) => data.bosses.find(b => b.id === id)?.cardNickname ?? ''
  const input = 'min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-950'

  if (moments && !saved) return <Celebration moments={moments} bosses={data.bosses} quests={data.quests} onDone={() => setSaved(true)} />
  if (saved) return <Card><H>Review saved</H><p className="mb-3 text-sm">Your numbers are up to date and the next cycle is open.</p><Btn className="w-full" onClick={() => go('hq')}>Back to overview</Btn></Card>

  return (
    <>
      <div>
        <p className="text-xs text-zinc-500">Cycle {cycle.startDate} to {cycle.endDate}</p>
        <ol className="mt-1 flex gap-1" aria-label="Progress">
          {STEPS.map((s, i) => <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-amber-600' : 'bg-stone-300 dark:bg-zinc-800'}`} aria-current={i === step ? 'step' : undefined} title={s} />)}
        </ol>
        <h1 className="mt-2 text-xl font-semibold">{step + 1}. {STEPS[step]}</h1>
      </div>

      {step === 0 && <Card className="space-y-3">
        <p className="text-sm">Confirm what your scheduled transfers did this cycle. Correct any amount that differs from your bank.</p>
        {data.bosses.filter(b => b.id in pay).map(b => <label key={b.id} className="block text-sm font-medium">
          {b.cardNickname} {b.id === state.activeBossId && <span className="font-normal text-amber-700 dark:text-amber-400">(current focus)</span>}
          <input className={input} inputMode="decimal" value={pay[b.id]} onChange={e => setPay(p => ({ ...p, [b.id]: e.target.value }))} /></label>)}
        {data.quests.filter(q => q.id in dep).map(q => <label key={q.id} className="block text-sm font-medium">
          {q.name} deposit
          <input className={input} inputMode="decimal" value={dep[q.id]} onChange={e => setDep(p => ({ ...p, [q.id]: e.target.value }))} /></label>)}
      </Card>}

      {step === 1 && <Card className="space-y-3">
        <p className="text-sm">Enter each card's current balance. Leave it blank if it matches. A higher balance is logged as interest or new charges; a lower one counts as an extra payment.</p>
        {data.bosses.map(b => {
          const expected = stages.afterA.bosses.find(s => s.id === b.id)!.currentBalance
          return <label key={b.id} className="block text-sm font-medium">
            {b.cardNickname} •••• {b.last4} <span className="font-normal text-zinc-500">(expected {money(expected)})</span>
            <input className={input} inputMode="decimal" placeholder={String(expected)} value={bal[b.id] ?? ''} onChange={e => setBal(p => ({ ...p, [b.id]: e.target.value }))} /></label>
        })}
      </Card>}

      {step === 2 && <Card className="space-y-3">
        <p className="text-sm">Total spent in each budget this cycle. Anything under the limit is available to allocate.</p>
        {data.lanes.map(l => {
          const logged = state.lanes.find(x => x.id === l.id)!
          return <label key={l.id} className="block text-sm font-medium">
            <span className="inline-flex items-center gap-2"><LaneMark color={l.color} name={l.name} />{l.name} <span className="font-normal text-zinc-500">(limit {money(l.budgetPerCycle)})</span></span>
            <input className={input} inputMode="decimal" value={spend[l.id] ?? String(logged.spent)} onChange={e => setSpend(p => ({ ...p, [l.id]: e.target.value }))} /></label>
        })}
      </Card>}

      {step === 3 && <Card className="space-y-4">
        <p className="text-sm">Set aside money for upcoming events, and log anything you spent on them. The suggestion spreads the remaining budget over the paydays left before the event month.</p>
        {openPlans.length === 0 && <p className="text-sm text-zinc-500">No planned events. Add Christmas, birthdays or trips on the Budgets tab.</p>}
        {openPlans.map(p => {
          const ps = state.plans.find(s => s.id === p.id)!
          return <div key={p.id} className="space-y-2">
            <p className="text-sm font-semibold">{p.name} <span className="font-normal text-zinc-500">· {monthLabel(p.month)} · budget {money(p.budget)}</span></p>
            <ProgressBar value={ps.funded} max={p.budget} color="#c8963e" label={`${p.name} funded`} height={8} />
            <p className="text-xs text-zinc-500">{money(ps.funded)} set aside · {money(ps.spent)} spent</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium">Set aside now
                <input className={input} inputMode="decimal" value={fund[p.id] ?? ''} onChange={e => setFund(f => ({ ...f, [p.id]: e.target.value }))} /></label>
              <label className="text-xs font-medium">Spent since last review
                <input className={input} inputMode="decimal" placeholder="0" value={planSpend[p.id] ?? ''} onChange={e => setPlanSpend(f => ({ ...f, [p.id]: e.target.value }))} /></label>
            </div>
          </div>
        })}
      </Card>}

      {step === 4 && <Card className="space-y-4">
        <p className="text-sm">Allocate what is left in each budget toward a debt or goal. Every $10 allocated earns points.</p>
        {data.lanes.map(l => {
          const swept = draft.find(e => e.type === 'sweep' && e.laneId === l.id)
          const logged = state.lanes.find(x => x.id === l.id)!
          const total = Math.max(logged.spent, num(spend[l.id] ?? String(logged.spent)))
          const remaining = Math.max(0, round2(l.budgetPerCycle - total - logged.swept))
          if (remaining <= 0) return <p key={l.id} className="text-sm text-zinc-500">{l.name}: nothing left to allocate.</p>
          const dest = sweepTo[l.id] ?? (state.activeBossId ? `boss:${state.activeBossId}` : '')
          const bossNeeds = dest.startsWith('boss:') ? stages.afterB.bosses.find(s => s.id === dest.slice(5))?.currentBalance ?? 0 : Infinity
          return <div key={l.id} className="space-y-2">
            <p className="text-sm font-semibold">{l.name}: {money(remaining)} left</p>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <select aria-label={`${l.name} destination`} className={input} value={dest} onChange={e => setSweepTo(p => ({ ...p, [l.id]: e.target.value }))}>
                {data.bosses.filter(b => stages.afterB.bosses.find(s => s.id === b.id)!.currentBalance > 0).map(b => <option key={b.id} value={`boss:${b.id}`}>Debt: {b.cardNickname}</option>)}
                {data.quests.map(q => <option key={q.id} value={`quest:${q.id}`}>Goal: {q.name}</option>)}
              </select>
              <input aria-label={`${l.name} amount`} className={input} inputMode="decimal" value={sweepAmt[l.id] ?? String(remaining)} onChange={e => setSweepAmt(p => ({ ...p, [l.id]: e.target.value }))} />
            </div>
            {num(sweepAmt[l.id] ?? String(remaining)) > bossNeeds && <p className="text-xs text-amber-700 dark:text-amber-400">That card only needs {money(bossNeeds)} more; the rest stays in the budget.</p>}
            {swept && <p className="text-xs text-zinc-500">Allocating {money(swept.amount)}</p>}
          </div>
        })}
      </Card>}

      {step === 5 && <Card className="space-y-3">
        <label className="block text-sm font-medium">No-spend days this cycle
          <input className={input} inputMode="numeric" value={noSpend} onChange={e => setNoSpend(e.target.value)} /></label>
        <label className="block text-sm font-medium">Windfall received? (tax refund, gift, bonus)
          <input className={input} inputMode="decimal" placeholder="$0" value={windfall} onChange={e => setWindfall(e.target.value)} /></label>
        {num(windfall) > 0 && <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-5" checked={split} onChange={e => setSplit(e.target.checked)} />
          <span>Follow the agreed split: {Math.round(data.config.bonusSplit.boss * 100)}% to the current debt ({money(num(windfall) * data.config.bonusSplit.boss)}), {Math.round(data.config.bonusSplit.quests * 100)}% to your first goal ({money(num(windfall) * data.config.bonusSplit.quests)}), {Math.round(data.config.bonusSplit.fun * 100)}% to spend. Earns bonus points.</span></label>}
      </Card>}

      {step === 6 && (() => {
        const score = finalState.cycles.find(c => c.cycleId === cycleId)!
        const rows: [string, number][] = [
          ['Review completed', score.breakdown.gameNight], ['Budgets under limit', score.breakdown.lanes], ['Allocated', score.breakdown.sweep],
          ['Extra payments', score.breakdown.extraBoss], ['No-spend days', score.breakdown.noSpend], ['Windfall split', score.breakdown.bonusSplit],
          ['Goal milestones', score.breakdown.levelUp], ['Debts paid off', score.breakdown.bossDefeated],
        ]
        const ups = finalState.levelUps.filter(l => l.cycleId === cycleId)
        const defeats = finalState.bossDefeats.filter(d => d.cycleId === cycleId)
        return <>
          <Card>
            <div className="text-center"><div className="font-serif text-5xl font-bold text-amber-700 dark:text-amber-400">+{score.xp}</div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">points this review</p>
              <p className="mt-1 text-sm">Streak {score.streak} · bonus {score.multiplier}x</p></div>
            <ul className="mt-3 text-sm">{rows.filter(([, v]) => v > 0).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></li>)}</ul>
            {score.multiplier > 1 && <p className="mt-1 text-right text-xs text-zinc-500">base {score.base} × {score.multiplier}</p>}
            {ups.map(u => <p key={`${u.questId}${u.level}`} className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Milestone {u.level} reached on {data.quests.find(q => q.id === u.questId)!.name}</p>)}
            {defeats.map(d => <p key={d.bossId} className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">{name(d.bossId)} paid off</p>)}
          </Card>
          <Card>
            <H>Balances after this review</H>
            <ul className="space-y-3">{data.bosses.map(b => {
              const s = finalState.bosses.find(x => x.id === b.id)!
              return <li key={b.id}><div className="flex justify-between text-sm"><span>{b.cardNickname}</span><b>{money(s.currentBalance)}</b></div>
                <ProgressBar value={s.currentBalance} max={b.startingBalance} color="#a8514a" label={b.cardNickname} /></li>
            })}</ul>
          </Card>
        </>
      })()}

      <div className="flex gap-2">
        {step > 0 && <Btn variant="ghost" onClick={() => setStep(s => s - 1)}>Back</Btn>}
        {step < STEPS.length - 1
          ? <Btn className="flex-1" onClick={() => setStep(s => s + 1)}>Next</Btn>
          : <Btn className="flex-1" onClick={commit}>Save review</Btn>}
      </div>
    </>
  )
}
