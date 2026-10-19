import { useState } from 'react'
import { useGame } from '../store'
import { monthLabel, suggestedSetAside } from '../engine/plans'
import { cycleLength, monthOffset } from '../data/model'
import { Btn, Card, Field, H, LaneMark, ProgressBar, money, num } from '../components/ui'
import { Icon } from '../components/Icon'

export default function Budgets() {
  const { data, state, cycleId, log, addPlan, removePlan, closePlan } = useGame()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ name: '', month: monthOffset(1), budget: '', yearly: false })
  const [adding, setAdding] = useState(false)
  const payday = data.cycles.find(c => c.id === cycleId)!.payday

  const plans = [...data.plans].sort((a, b) => a.month.localeCompare(b.month))
  const open = plans.filter(p => !state.plans.find(s => s.id === p.id)!.closed)
  const closed = plans.filter(p => state.plans.find(s => s.id === p.id)!.closed)
  const byMonth = open.reduce<Record<string, typeof open>>((acc, p) => ((acc[p.month] ??= []).push(p), acc), {})
  const totalNeeded = open.reduce((t, p) => t + Math.max(0, p.budget - state.plans.find(s => s.id === p.id)!.funded), 0)
  const perCycle = open.reduce((t, p) => t + suggestedSetAside(p, state.plans.find(s => s.id === p.id)!.funded, payday, cycleLength(data.config)), 0)

  const spendOn = (key: string, make: (amount: number) => void) => {
    const amount = num(draft[key])
    if (!amount) return
    make(amount)
    setDraft(d => ({ ...d, [key]: '' }))
  }

  const submit = () => {
    if (!form.name.trim() || num(form.budget) <= 0 || !form.month) return
    addPlan({ name: form.name.trim(), month: form.month, budget: num(form.budget), yearly: form.yearly })
    setForm({ name: '', month: monthOffset(1), budget: '', yearly: false })
    setAdding(false)
  }

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Each cycle has a spending limit per budget. Anything left over can be allocated to a debt or goal at your review.</p>
      {data.lanes.map(l => {
        const s = state.lanes.find(x => x.id === l.id)!
        return (
          <Card key={l.id}>
            <div className="flex items-center justify-between">
              <H><span className="inline-flex items-center gap-2"><LaneMark color={l.color} name={l.name} />{l.name}</span></H>
              <span className="flex items-center gap-1 text-sm text-zinc-500"><Icon name="flame" size={14} className="text-amber-600" />{s.streak}</span>
            </div>
            <ProgressBar value={s.spent + s.swept} max={l.budgetPerCycle} color={l.color} label={`${l.name} spent`} />
            <p className="mt-2 text-sm">Limit <b>{money(l.budgetPerCycle)}</b> · spent <b>{money(s.spent)}</b> · left <b>{money(s.remaining)}</b></p>
            <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); spendOn(l.id, amount => log([{ type: 'laneSpend', laneId: l.id, amount }])) }}>
              <input inputMode="decimal" placeholder="Log spending $" aria-label={`${l.name} spend amount`} value={draft[l.id] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [l.id]: e.target.value }))}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950" />
              <Btn type="submit" variant="ghost">Add</Btn>
            </form>
          </Card>
        )
      })}

      <div className="flex items-end justify-between pt-2">
        <h2 className="text-lg font-semibold">Planned events</h2>
        {!adding && <Btn variant="ghost" className="min-h-9 !px-3 !py-1" onClick={() => setAdding(true)}>Add event</Btn>}
      </div>
      <p className="-mt-2 text-sm text-zinc-600 dark:text-zinc-300">Christmas, birthdays, trips. Set a budget for the month it happens and fund it a little each cycle so it never lands on a card.</p>

      {adding && (
        <Card className="space-y-3">
          <Field label="Event" placeholder="e.g. Christmas, Mom's birthday, Beach week" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Month" type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
            <Field label="Budget $" inputMode="decimal" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={form.yearly} onChange={e => setForm(f => ({ ...f, yearly: e.target.checked }))} />Repeats every year</label>
          <div className="flex gap-2"><Btn className="flex-1" onClick={submit}>Save event</Btn><Btn variant="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </Card>
      )}

      {open.length > 0 && (
        <Card>
          <p className="text-sm">Still to set aside: <b>{money(totalNeeded)}</b>. About <b>{money(perCycle)}</b> this cycle keeps every event on schedule.</p>
        </Card>
      )}
      {open.length === 0 && !adding && <Card><p className="text-sm text-zinc-500">No events planned. Add the next birthday, holiday or trip.</p></Card>}

      {Object.entries(byMonth).map(([month, list]) => (
        <section key={month} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-zinc-500">{monthLabel(month)}</h3>
          {list.map(p => {
            const ps = state.plans.find(s => s.id === p.id)!
            const suggest = suggestedSetAside(p, ps.funded, payday, cycleLength(data.config))
            const over = ps.spent > p.budget
            return (
              <Card key={p.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold">{p.name}{p.yearly && <span className="ml-2 text-xs font-normal text-zinc-500">yearly</span>}</p>
                  <span className="text-sm text-zinc-500">{money(p.budget)}</span>
                </div>
                <div className="mt-2"><ProgressBar value={ps.funded} max={p.budget} color="#c8963e" label={`${p.name} funded`} height={10} /></div>
                <p className="mt-1 text-xs text-zinc-500">{money(ps.funded)} set aside{suggest > 0 ? ` · ${money(suggest)} suggested this cycle` : ' · fully funded'}</p>
                <div className="mt-2"><ProgressBar value={ps.spent} max={p.budget} color={over ? '#a8514a' : '#5f8a6e'} label={`${p.name} spent`} height={10} /></div>
                <p className={`mt-1 text-xs ${over ? 'text-rose-700 dark:text-rose-400' : 'text-zinc-500'}`}>{money(ps.spent)} spent · {over ? `${money(ps.spent - p.budget)} over budget` : `${money(p.budget - ps.spent)} left`}</p>
                <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); spendOn(p.id, amount => log([{ type: 'planSpend', planId: p.id, amount }])) }}>
                  <input inputMode="decimal" placeholder="Log spending $" aria-label={`${p.name} spend amount`} value={draft[p.id] ?? ''}
                    onChange={e => setDraft(d => ({ ...d, [p.id]: e.target.value }))}
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950" />
                  <Btn type="submit" variant="ghost">Add</Btn>
                </form>
                <div className="mt-2 flex gap-2">
                  <Btn variant="ghost" className="min-h-9 flex-1 !py-1" onClick={() => closePlan(p.id)}>{over ? 'Close event' : 'Close event (earns points)'}</Btn>
                  <Btn variant="ghost" className="min-h-9 !py-1" aria-label={`Delete ${p.name}`} onClick={() => { if (confirm(`Delete "${p.name}" and everything logged against it?`)) removePlan(p.id) }}>Delete</Btn>
                </div>
              </Card>
            )
          })}
        </section>
      ))}

      {closed.length > 0 && (
        <Card>
          <H>Closed events</H>
          <ul className="text-sm">
            {closed.map(p => {
              const ps = state.plans.find(s => s.id === p.id)!
              return <li key={p.id} className="flex justify-between border-b border-stone-100 py-1.5 last:border-0 dark:border-zinc-800">
                <span>{p.name} <span className="text-zinc-500">{monthLabel(p.month)}</span></span>
                <span className={ps.spent > p.budget ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>{money(ps.spent)} of {money(p.budget)}</span>
              </li>
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
