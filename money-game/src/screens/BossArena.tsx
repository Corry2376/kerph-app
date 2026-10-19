import { useGame } from '../store'
import { Btn, Card, H, ProgressBar, money } from '../components/ui'
import { BossArt } from '../components/BossArt'

export default function BossArena() {
  const { data, state, moveBoss } = useGame()
  const active = data.bosses.find(b => b.id === state.activeBossId)
  const as = state.bosses.find(b => b.id === state.activeBossId)
  const cycleLabel = (id: string) => data.cycles.find(c => c.id === id)?.payday ?? id

  return (
    <>
      {active && as ? (
        <Card>
          <H>{active.cardNickname} <span className="font-normal text-zinc-500">•••• {active.last4}</span></H>
          <div className="mb-3 flex justify-center text-zinc-700 dark:text-zinc-300"><BossArt seed={active.artSeed} size={170} label={active.cardNickname} /></div>
          <ProgressBar value={as.currentBalance} max={active.startingBalance} color="#ef4444" label="Boss health" />
          <p className="mt-2 text-sm"><b>{money(as.currentBalance)}</b> / {money(active.startingBalance)} · {active.rate}% APR · attack {money(state.attackPower)} per cycle</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><h3 className="font-semibold">Damage dealt</h3>
              {as.hits.length === 0 && <p className="text-zinc-500">No hits yet.</p>}
              <ul>{[...as.hits].reverse().slice(0, 8).map(h => <li key={h.eventId}>{money(h.amount)} <span className="text-zinc-500">{cycleLabel(h.cycleId)}</span></li>)}</ul></div>
            <div><h3 className="font-semibold">Healed (interest)</h3>
              {as.heals.length === 0 && <p className="text-zinc-500">None.</p>}
              <ul>{[...as.heals].reverse().slice(0, 8).map(h => <li key={h.eventId}>+{money(h.amount)} <span className="text-zinc-500">{cycleLabel(h.cycleId)}</span></li>)}</ul></div>
          </div>
        </Card>
      ) : <Card><H>All bosses defeated</H></Card>}

      <Card>
        <H>Boss queue</H>
        <ol className="space-y-2">
          {data.bosses.map((b, i) => {
            const s = state.bosses.find(x => x.id === b.id)!
            return (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-zinc-500">{i + 1}.</span>
                <span className="flex-1">
                  <b>{b.cardNickname}</b> •••• {b.last4}
                  <span className="block text-xs text-zinc-500">
                    {s.status === 'defeated' ? 'defeated' : `${money(s.currentBalance)} · ${b.rate}% · ${s.status}`}
                  </span>
                </span>
                <Btn variant="ghost" className="min-h-9 !px-3" aria-label={`Move ${b.cardNickname} up`} disabled={i === 0} onClick={() => moveBoss(b.id, -1)}>↑</Btn>
                <Btn variant="ghost" className="min-h-9 !px-3" aria-label={`Move ${b.cardNickname} down`} disabled={i === data.bosses.length - 1} onClick={() => moveBoss(b.id, 1)}>↓</Btn>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-xs text-zinc-500">When a boss falls, its minimum and autopilot attack roll into the next boss.</p>
      </Card>
    </>
  )
}
