import { useGame } from '../store'
import { Btn, Card, H, ProgressBar, money } from '../components/ui'
import { DebtMark } from '../components/DebtMark'

export default function Debts() {
  const { data, state, moveBoss } = useGame()
  const active = data.bosses.find(b => b.id === state.activeBossId)
  const as = state.bosses.find(b => b.id === state.activeBossId)
  const cycleLabel = (id: string) => data.cycles.find(c => c.id === id)?.payday ?? id

  return (
    <>
      {active && as ? (
        <Card>
          <H>Current focus</H>
          <div className="flex items-center gap-4">
            <div className="shrink-0 text-zinc-600 dark:text-zinc-300"><DebtMark seed={active.artSeed} size={96} label={active.cardNickname} /></div>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{active.cardNickname}</p>
              <p className="text-sm text-zinc-500">•••• {active.last4} · {active.rate}% APR</p>
            </div>
          </div>
          <div className="mt-3"><ProgressBar value={as.currentBalance} max={active.startingBalance} color="#a8514a" label="Remaining balance" /></div>
          <p className="mt-2 text-sm"><b>{money(as.currentBalance)}</b> of {money(active.startingBalance)} remaining · paying <b>{money(state.attackPower)}</b> per cycle</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><h3 className="font-semibold">Payments</h3>
              {as.hits.length === 0 && <p className="text-zinc-500">None yet.</p>}
              <ul>{[...as.hits].reverse().slice(0, 8).map(h => <li key={h.eventId}>{money(h.amount)} <span className="text-zinc-500">{cycleLabel(h.cycleId)}</span></li>)}</ul></div>
            <div><h3 className="font-semibold">Interest charged</h3>
              {as.heals.length === 0 && <p className="text-zinc-500">None.</p>}
              <ul>{[...as.heals].reverse().slice(0, 8).map(h => <li key={h.eventId}>+{money(h.amount)} <span className="text-zinc-500">{cycleLabel(h.cycleId)}</span></li>)}</ul></div>
          </div>
        </Card>
      ) : <Card><H>Every card is paid off</H><p className="text-sm text-zinc-500">Nothing left in the queue.</p></Card>}

      <Card>
        <H>Payoff order</H>
        <ol className="space-y-2">
          {data.bosses.map((b, i) => {
            const s = state.bosses.find(x => x.id === b.id)!
            return (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-zinc-500">{i + 1}.</span>
                <span className="flex-1">
                  <b>{b.cardNickname}</b> •••• {b.last4}
                  <span className="block text-xs text-zinc-500">
                    {s.status === 'defeated' ? 'paid off' : `${money(s.currentBalance)} · ${b.rate}%${s.status === 'rematch' ? ' · balance returned' : ''}`}
                  </span>
                </span>
                <Btn variant="ghost" className="min-h-9 !px-3" aria-label={`Move ${b.cardNickname} up`} disabled={i === 0} onClick={() => moveBoss(b.id, -1)}>↑</Btn>
                <Btn variant="ghost" className="min-h-9 !px-3" aria-label={`Move ${b.cardNickname} down`} disabled={i === data.bosses.length - 1} onClick={() => moveBoss(b.id, 1)}>↓</Btn>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-xs text-zinc-500">When a card is paid off, its minimum and extra payment roll into the next one.</p>
      </Card>
    </>
  )
}
