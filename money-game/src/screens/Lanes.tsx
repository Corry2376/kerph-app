import { useState } from 'react'
import { useGame } from '../store'
import { Btn, Card, H, ProgressBar, money, num } from '../components/ui'

export default function Lanes() {
  const { data, state, log } = useGame()
  const [draft, setDraft] = useState<Record<string, string>>({})

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-300">Spending in a lane is always guilt-free. What's left at game night gets swept toward a goal and earns XP.</p>
      {data.lanes.map(l => {
        const s = state.lanes.find(x => x.id === l.id)!
        const add = () => {
          const amount = num(draft[l.id])
          if (!amount) return
          log([{ type: 'laneSpend', laneId: l.id, amount }])
          setDraft(d => ({ ...d, [l.id]: '' }))
        }
        return (
          <Card key={l.id}>
            <div className="flex items-baseline justify-between">
              <H><span aria-hidden>{l.icon}</span> {l.name}</H>
              <span className="text-sm">🔥 {s.streak}</span>
            </div>
            <ProgressBar value={s.spent + s.swept} max={l.budgetPerCycle} color={l.color} label={`${l.name} spent`} />
            <p className="mt-2 text-sm">Budget <b>{money(l.budgetPerCycle)}</b> · spent <b>{money(s.spent)}</b> · left <b>{money(s.remaining)}</b></p>
            <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); add() }}>
              <input inputMode="decimal" placeholder="Log spend $" aria-label={`${l.name} spend amount`} value={draft[l.id] ?? ''}
                onChange={e => setDraft(d => ({ ...d, [l.id]: e.target.value }))}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" />
              <Btn type="submit" variant="ghost">Add</Btn>
            </form>
          </Card>
        )
      })}
    </>
  )
}
