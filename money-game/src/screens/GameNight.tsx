import { useMemo, useState } from 'react'
import { useGame } from '../store'
import { computeState } from '../engine/engine'
import type { GameEvent } from '../engine/types'
import { uid } from '../data/model'
import { Btn, Card, H, ProgressBar, money, num } from '../components/ui'
import type { Tab } from '../App'

const STEPS = ['Autopilot', 'Cards', 'Lanes', 'Sweep', 'Extras', 'Score'] as const
type Draft = Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>
const round2 = (n: number) => Math.round(n * 100) / 100

export default function GameNight({ go }: { go: (t: Tab) => void }) {
  const { data, state, cycleId, commitGameNight } = useGame()
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)

  // Defaults: the plan autopilot should have executed.
  const [pay, setPay] = useState<Record<string, string>>(() => Object.fromEntries(
    data.bosses.flatMap(b => {
      const s = state.bosses.find(x => x.id === b.id)!
      if (s.status === 'defeated') return []
      const planned = b.id === state.activeBossId ? state.attackPower : b.minPayment
      return [[b.id, String(Math.min(planned, s.currentBalance))]]
    })))
  const [dep, setDep] = useState<Record<string, string>>(() => Object.fromEntries(
    data.quests.filter(q => q.status === 'active').map(q => [q.id, String(q.autopilotDeposit)])))
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
    const events = [...a, ...b, ...c, ...sweeps, ...e, { type: 'gameNight', amount: 0 } as Draft]
    return { draft: events, stages: { afterA, afterB } }
  }, [data, state, cycleId, pay, dep, bal, spend, sweepAmt, sweepTo, noSpend, windfall, split])

  const finalState = useMemo(() => computeState({
    ...data, events: [...data.events, ...draft.map((e, i) => ({ ...e, id: `d${i}`, timestamp: Date.now() + i, cycleId }))],
  }), [data, draft, cycleId])

  const commit = () => {
    const t = Date.now()
    commitGameNight(draft.map((e, i) => ({ ...e, id: uid(), timestamp: t + i, cycleId })))
    setSaved(true)
  }

  const cycle = data.cycles.find(c => c.id === cycleId)!
  const name = (id: string) => data.bosses.find(b => b.id === id)?.cardNickname ?? ''
  const input = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-900'

  if (saved) {
    return <Card><H>Locked in 🎉</H><p className="mb-3">Game night saved. Next cycle is open.</p><Btn className="w-full" onClick={() => go('hq')}>Back to HQ</Btn></Card>
  }

  return (
    <>
      <div>
        <p className="text-xs text-slate-500">Cycle {cycle.startDate} to {cycle.endDate}</p>
        <ol className="mt-1 flex gap-1" aria-label="Progress">
          {STEPS.map((s, i) => <li key={s} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`} aria-current={i === step ? 'step' : undefined} title={s} />)}
        </ol>
        <h1 className="mt-2 text-xl font-black">{step + 1}. {STEPS[step]}</h1>
      </div>

      {step === 0 && <Card className="space-y-3">
        <p className="text-sm">Did autopilot run? Fix any amount that differs from your bank.</p>
        {data.bosses.filter(b => b.id in pay).map(b => <label key={b.id} className="block text-sm font-medium">
          {b.cardNickname} {b.id === state.activeBossId && '👹 (boss)'}
          <input className={input} inputMode="decimal" value={pay[b.id]} onChange={e => setPay(p => ({ ...p, [b.id]: e.target.value }))} /></label>)}
        {data.quests.filter(q => q.id in dep).map(q => <label key={q.id} className="block text-sm font-medium">
          {q.name} deposit
          <input className={input} inputMode="decimal" value={dep[q.id]} onChange={e => setDep(p => ({ ...p, [q.id]: e.target.value }))} /></label>)}
      </Card>}

      {step === 1 && <Card className="space-y-3">
        <p className="text-sm">Enter each card's balance from your statement or app. Leave blank if it matches. Higher means interest or new charges (it heals the boss); lower counts as extra damage.</p>
        {data.bosses.map(b => {
          const expected = stages.afterA.bosses.find(s => s.id === b.id)!.currentBalance
          return <label key={b.id} className="block text-sm font-medium">
            {b.cardNickname} •••• {b.last4} <span className="font-normal text-slate-500">(expected {money(expected)})</span>
            <input className={input} inputMode="decimal" placeholder={String(expected)} value={bal[b.id] ?? ''} onChange={e => setBal(p => ({ ...p, [b.id]: e.target.value }))} /></label>
        })}
      </Card>}

      {step === 2 && <Card className="space-y-3">
        <p className="text-sm">Total spent in each lane this cycle. Anything under budget is a win.</p>
        {data.lanes.map(l => {
          const logged = state.lanes.find(x => x.id === l.id)!
          return <label key={l.id} className="block text-sm font-medium">
            {l.icon} {l.name} <span className="font-normal text-slate-500">(budget {money(l.budgetPerCycle)})</span>
            <input className={input} inputMode="decimal" value={spend[l.id] ?? String(logged.spent)} onChange={e => setSpend(p => ({ ...p, [l.id]: e.target.value }))} /></label>
        })}
      </Card>}

      {step === 3 && <Card className="space-y-4">
        <p className="text-sm">Sweep what's left in each lane toward a goal. Every $10 swept earns XP.</p>
        {data.lanes.map(l => {
          const swept = draft.find(e => e.type === 'sweep' && e.laneId === l.id)
          const logged = state.lanes.find(x => x.id === l.id)!
          const total = Math.max(logged.spent, num(spend[l.id] ?? String(logged.spent)))
          const remaining = Math.max(0, round2(l.budgetPerCycle - total - logged.swept))
          if (remaining <= 0) return <p key={l.id} className="text-sm text-slate-500">{l.icon} {l.name}: nothing left to sweep.</p>
          const dest = sweepTo[l.id] ?? (state.activeBossId ? `boss:${state.activeBossId}` : '')
          return <div key={l.id} className="space-y-2">
            <p className="text-sm font-semibold">{l.icon} {l.name}: {money(remaining)} left</p>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <select aria-label={`${l.name} sweep destination`} className={input} value={dest} onChange={e => setSweepTo(p => ({ ...p, [l.id]: e.target.value }))}>
                {data.bosses.filter(b => stages.afterB.bosses.find(s => s.id === b.id)!.currentBalance > 0).map(b => <option key={b.id} value={`boss:${b.id}`}>👹 {b.cardNickname}</option>)}
                {data.quests.map(q => <option key={q.id} value={`quest:${q.id}`}>🏆 {q.name}</option>)}
              </select>
              <input aria-label={`${l.name} sweep amount`} className={input} inputMode="decimal" value={sweepAmt[l.id] ?? String(remaining)} onChange={e => setSweepAmt(p => ({ ...p, [l.id]: e.target.value }))} />
            </div>
            {dest.startsWith('boss:') && num(sweepAmt[l.id] ?? String(remaining)) > (stages.afterB.bosses.find(s => s.id === dest.slice(5))?.currentBalance ?? 0) &&
              <p className="text-xs text-amber-600">That boss only needs {money(stages.afterB.bosses.find(s => s.id === dest.slice(5))!.currentBalance)} more; the rest stays in the lane.</p>}
            {swept && <p className="text-xs text-slate-500">Sweeping {money(swept.amount)}</p>}
          </div>
        })}
      </Card>}

      {step === 4 && <Card className="space-y-3">
        <label className="block text-sm font-medium">No-spend days this cycle
          <input className={input} inputMode="numeric" value={noSpend} onChange={e => setNoSpend(e.target.value)} /></label>
        <label className="block text-sm font-medium">Windfall received? (tax refund, gift, bonus…)
          <input className={input} inputMode="decimal" placeholder="$0" value={windfall} onChange={e => setWindfall(e.target.value)} /></label>
        {num(windfall) > 0 && <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-5" checked={split} onChange={e => setSplit(e.target.checked)} />
          <span>Follow the split: {Math.round(data.config.bonusSplit.boss * 100)}% boss ({money(num(windfall) * data.config.bonusSplit.boss)}), {Math.round(data.config.bonusSplit.quests * 100)}% first quest ({money(num(windfall) * data.config.bonusSplit.quests)}), {Math.round(data.config.bonusSplit.fun * 100)}% fun. Earns bonus XP.</span></label>}
      </Card>}

      {step === 5 && (() => {
        const score = finalState.cycles.find(c => c.cycleId === cycleId)!
        const rows: [string, number][] = [
          ['Game night', score.breakdown.gameNight], ['Lanes under budget', score.breakdown.lanes], ['Swept', score.breakdown.sweep],
          ['Extra boss damage', score.breakdown.extraBoss], ['No-spend days', score.breakdown.noSpend],
          ['Bonus split', score.breakdown.bonusSplit], ['Quest levels', score.breakdown.levelUp], ['Boss defeated', score.breakdown.bossDefeated],
        ]
        const ups = finalState.levelUps.filter(l => l.cycleId === cycleId)
        const defeats = finalState.bossDefeats.filter(d => d.cycleId === cycleId)
        return <>
          <Card>
            <div className="text-center"><div className="text-5xl font-black text-indigo-600 dark:text-indigo-400">+{score.xp} XP</div>
              <p className="text-sm">🔥 Streak {score.streak} · {score.multiplier}x multiplier</p></div>
            <ul className="mt-3 text-sm">{rows.filter(([, v]) => v > 0).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></li>)}</ul>
            {score.multiplier > 1 && <p className="mt-1 text-right text-xs text-slate-500">base {score.base} × {score.multiplier}</p>}
            {ups.map(u => <p key={`${u.questId}${u.level}`} className="mt-2 font-semibold text-emerald-600">🏆 Level {u.level} cleared on {data.quests.find(q => q.id === u.questId)!.name}!</p>)}
            {defeats.map(d => <p key={d.bossId} className="mt-2 font-semibold text-rose-600">💀 {name(d.bossId)} defeated!</p>)}
          </Card>
          <Card>
            <H>Bosses after tonight</H>
            <ul className="space-y-3">{data.bosses.map(b => {
              const s = finalState.bosses.find(x => x.id === b.id)!
              return <li key={b.id}><div className="flex justify-between text-sm"><span>{b.cardNickname}</span><b>{money(s.currentBalance)}</b></div>
                <ProgressBar value={s.currentBalance} max={b.startingBalance} color="#ef4444" label={b.cardNickname} /></li>
            })}</ul>
          </Card>
        </>
      })()}

      <div className="flex gap-2">
        {step > 0 && <Btn variant="ghost" onClick={() => setStep(s => s - 1)}>Back</Btn>}
        {step < STEPS.length - 1
          ? <Btn className="flex-1" onClick={() => setStep(s => s + 1)}>Next</Btn>
          : <Btn className="flex-1" onClick={commit}>Lock it in</Btn>}
      </div>
    </>
  )
}
