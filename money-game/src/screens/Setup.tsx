import { useState } from 'react'
import { useGame } from '../store'
import { Btn, Card, Field, H, num } from '../components/ui'
import { DEFAULT_CONFIG } from '../engine/config'
import { buildGame, monthOffset, nextWeekday, todayIso } from '../data/model'

interface QuestRow { name: string; target: string; date: string; levels: string; autopilot: string }
interface BossRow { name: string; last4: string; rate: string; balance: string; min: string; attack: string }
interface LaneRow { name: string; budget: string }
interface PlanRow { name: string; month: string; budget: string; yearly: boolean }

const STEPS = ['People', 'Pay cycle', 'Goals', 'Debts', 'Budgets', 'Events'] as const

export default function Setup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { data, replaceGame } = useGame()
  const [step, setStep] = useState(0)
  const [players, setPlayers] = useState(['', ''])
  const [payCycle, setPayCycle] = useState<'weekly' | 'biweekly'>('weekly')
  const [bossOrder, setBossOrder] = useState<'snowball' | 'avalanche'>('snowball')
  const [firstPayday, setFirstPayday] = useState(nextWeekday(todayIso(), 'friday'))
  const [quests, setQuests] = useState<QuestRow[]>([{ name: '', target: '', date: '', levels: '10', autopilot: '' }])
  const [bosses, setBosses] = useState<BossRow[]>([{ name: '', last4: '', rate: '', balance: '', min: '', attack: '' }])
  const [lanes, setLanes] = useState<LaneRow[]>(['Kids', 'Tools', 'Travel', 'Everyday', 'Rewards'].map(name => ({ name, budget: '' })))
  const [plans, setPlans] = useState<PlanRow[]>([{ name: 'Christmas', month: monthOffset(0, 12), budget: '', yearly: true }])
  const [error, setError] = useState('')

  const patch = <T,>(set: (f: (r: T[]) => T[]) => void, i: number, p: Partial<T>) =>
    set(rows => rows.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const validate = (): string => {
    if (step === 2 && !quests.some(q => q.name.trim() && num(q.target) > 0 && q.date)) return 'Add at least one goal with a name, target amount and date.'
    if (step === 3) {
      const valid = bosses.filter(b => b.name.trim())
      if (valid.length === 0) return 'Add at least one card.'
      if (valid.some(b => !/^\d{4}$/.test(b.last4))) return 'Last four digits must be exactly 4 numbers. Never enter a full card number.'
      if (valid.some(b => num(b.balance) <= 0)) return 'Each card needs its current balance.'
    }
    if (step === 4 && !lanes.some(l => l.name.trim())) return 'Add at least one budget.'
    return ''
  }

  const next = () => {
    const err = validate()
    setError(err)
    if (!err) setStep(s => s + 1)
  }

  const finish = () => {
    const err = validate()
    if (err) return setError(err)
    if (!data.isDemo && !confirm('This replaces your current game. Export a backup first if you want to keep it. Continue?')) return
    const config = { ...DEFAULT_CONFIG, payCycle, bossOrder }
    replaceGame(buildGame({
      players: players.map(name => ({ name: name.trim() })),
      config,
      firstPayday,
      quests: quests.filter(q => q.name.trim() && num(q.target) > 0).map(q => ({
        name: q.name.trim(), targetAmount: num(q.target), targetDate: q.date,
        levelCount: Math.max(1, Math.round(num(q.levels)) || config.levelsPerQuest), autopilotDeposit: num(q.autopilot),
      })),
      bosses: bosses.filter(b => b.name.trim()).map(b => ({
        cardNickname: b.name.trim(), last4: b.last4, rate: num(b.rate), startingBalance: num(b.balance),
        minPayment: num(b.min), autopilotAttack: num(b.attack),
      })),
      lanes: lanes.filter(l => l.name.trim()).map(l => ({ name: l.name.trim(), budgetPerCycle: num(l.budget) })),
      plans: plans.filter(p => p.name.trim() && num(p.budget) > 0 && p.month).map(p => ({ name: p.name.trim(), month: p.month, budget: num(p.budget), yearly: p.yearly })),
    }))
    onDone()
  }

  const last = step === STEPS.length - 1
  return (
    <div className="mx-auto min-h-dvh max-w-xl space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Setup · {STEPS[step]} <span className="text-sm font-normal text-zinc-500">({step + 1}/{STEPS.length})</span></h1>
        <Btn variant="ghost" className="min-h-9 text-sm" onClick={onCancel}>Cancel</Btn>
      </header>

      {step === 0 && <Card><H>Who is in this household?</H><div className="space-y-3">
        {players.map((p, i) => <Field key={i} label={`Person ${i + 1}`} value={p} placeholder="Name" onChange={e => setPlayers(ps => ps.map((x, j) => j === i ? e.target.value : x))} />)}
      </div></Card>}

      {step === 1 && <Card className="space-y-3"><H>Pay cycle</H>
        <label className="block text-sm font-medium">How often do you get paid?
          <select value={payCycle} onChange={e => setPayCycle(e.target.value as 'weekly' | 'biweekly')} className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900">
            <option value="weekly">Every Friday</option><option value="biweekly">Every other Friday</option></select></label>
        <Field label="First payday of the game" type="date" value={firstPayday} onChange={e => setFirstPayday(e.target.value)} />
        <label className="block text-sm font-medium">Which card do you pay down first?
          <select value={bossOrder} onChange={e => setBossOrder(e.target.value as 'snowball' | 'avalanche')} className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900">
            <option value="snowball">Smallest balance first (snowball)</option><option value="avalanche">Highest rate first (avalanche)</option></select></label>
      </Card>}

      {step === 2 && <>
        {quests.map((q, i) => <Card key={i} className="space-y-3">
          <Field label="Goal name" value={q.name} placeholder="e.g. Emergency fund" onChange={e => patch(setQuests, i, { name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target $" inputMode="decimal" value={q.target} onChange={e => patch(setQuests, i, { target: e.target.value })} />
            <Field label="Target date" type="date" value={q.date} onChange={e => patch(setQuests, i, { date: e.target.value })} />
            <Field label="Milestones" inputMode="numeric" value={q.levels} onChange={e => patch(setQuests, i, { levels: e.target.value })} />
            <Field label="Autopilot $/cycle" inputMode="decimal" value={q.autopilot} onChange={e => patch(setQuests, i, { autopilot: e.target.value })} />
          </div>
          {quests.length > 1 && <Btn variant="ghost" onClick={() => setQuests(qs => qs.filter((_, j) => j !== i))}>Remove</Btn>}
        </Card>)}
        <Btn variant="ghost" onClick={() => setQuests(q => [...q, { name: '', target: '', date: '', levels: '10', autopilot: '' }])}>+ Add goal</Btn>
      </>}

      {step === 3 && <>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">List each card you are paying down. Use a nickname and the last four digits only, never a full card number.</p>
        {bosses.map((b, i) => <Card key={i} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Card nickname" value={b.name} onChange={e => patch(setBosses, i, { name: e.target.value })} />
            <Field label="Last 4 digits" inputMode="numeric" maxLength={4} value={b.last4} onChange={e => patch(setBosses, i, { last4: e.target.value.replace(/\D/g, '') })} />
            <Field label="Balance $" inputMode="decimal" value={b.balance} onChange={e => patch(setBosses, i, { balance: e.target.value })} />
            <Field label="APR %" inputMode="decimal" value={b.rate} onChange={e => patch(setBosses, i, { rate: e.target.value })} />
            <Field label="Minimum payment $" inputMode="decimal" value={b.min} onChange={e => patch(setBosses, i, { min: e.target.value })} />
            <Field label="Extra autopilot payment $" hint="On top of the minimum" inputMode="decimal" value={b.attack} onChange={e => patch(setBosses, i, { attack: e.target.value })} />
          </div>
          {bosses.length > 1 && <Btn variant="ghost" onClick={() => setBosses(bs => bs.filter((_, j) => j !== i))}>Remove</Btn>}
        </Card>)}
        <Btn variant="ghost" onClick={() => setBosses(b => [...b, { name: '', last4: '', rate: '', balance: '', min: '', attack: '' }])}>+ Add card</Btn>
      </>}

      {step === 4 && <Card className="space-y-3"><H>Spending budgets (per cycle)</H>
        {lanes.map((l, i) => <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <Field label="Budget" value={l.name} onChange={e => patch(setLanes, i, { name: e.target.value })} />
          <Field label="Budget $" inputMode="decimal" value={l.budget} onChange={e => patch(setLanes, i, { budget: e.target.value })} />
          <Btn variant="ghost" aria-label={`Remove ${l.name || 'budget'}`} onClick={() => setLanes(ls => ls.filter((_, j) => j !== i))}>✕</Btn>
        </div>)}
        <Btn variant="ghost" onClick={() => setLanes(l => [...l, { name: '', budget: '' }])}>+ Add budget</Btn>
      </Card>}

      {step === 5 && <>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Planned events get their own budget in the month they happen: holidays, birthdays, trips. You fund them a little each cycle. Leave the budget blank to skip one.</p>
        {plans.map((p, i) => <Card key={i} className="space-y-3">
          <Field label="Event" value={p.name} placeholder="e.g. Mom's birthday" onChange={e => patch(setPlans, i, { name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Month" type="month" value={p.month} onChange={e => patch(setPlans, i, { month: e.target.value })} />
            <Field label="Budget $" inputMode="decimal" value={p.budget} onChange={e => patch(setPlans, i, { budget: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={p.yearly} onChange={e => patch(setPlans, i, { yearly: e.target.checked })} />Repeats every year</label>
          <Btn variant="ghost" onClick={() => setPlans(ps => ps.filter((_, j) => j !== i))}>Remove</Btn>
        </Card>)}
        <Btn variant="ghost" onClick={() => setPlans(ps => [...ps, { name: '', month: monthOffset(1), budget: '', yearly: false }])}>+ Add event</Btn>
      </>}

      {error && <p role="alert" className="font-semibold text-rose-600">{error}</p>}
      <div className="flex gap-2">
        {step > 0 && <Btn variant="ghost" onClick={() => { setError(''); setStep(s => s - 1) }}>Back</Btn>}
        <Btn className="flex-1" onClick={last ? finish : next}>{last ? 'Finish setup' : 'Next'}</Btn>
      </div>
    </div>
  )
}
