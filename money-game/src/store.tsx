import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { computeState } from './engine/engine'
import type { Config, EngineState, GameEvent } from './engine/types'
import { loadGame, saveGame } from './data/db'
import { demoGame, nextCycle, uid, type GameData } from './data/model'

interface Store {
  data: GameData
  state: EngineState
  cycleId: string
  /** Log events into the cycle in progress. */
  log: (events: Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>[]) => void
  /** Commit a finished game night and open the next cycle. */
  commitGameNight: (events: GameEvent[]) => void
  replaceGame: (data: GameData) => void
  resetToDemo: () => void
  setConfig: (config: Config) => void
  moveBoss: (id: string, dir: -1 | 1) => void
}

const Ctx = createContext<Store | null>(null)
export const useGame = () => useContext(Ctx)!

export function GameProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GameData | null>(null)

  useEffect(() => { loadGame().then(d => setData(d ?? demoGame())) }, [])
  useEffect(() => { if (data) void saveGame(data) }, [data])

  const state = useMemo(() => (data ? computeState(data) : null), [data])
  if (!data || !state) return <div className="p-8 text-center">Loading…</div>

  const cycleId = data.cycles[data.cycles.length - 1].id
  const stamp = (events: Omit<GameEvent, 'id' | 'timestamp' | 'cycleId'>[], cycle: string): GameEvent[] =>
    events.map((e, i) => ({ ...e, id: uid(), timestamp: Date.now() + i, cycleId: cycle }))

  const store: Store = {
    data, state, cycleId,
    log: events => setData(d => d && { ...d, events: [...d.events, ...stamp(events, cycleId)] }),
    commitGameNight: events => setData(d => d && {
      ...d,
      events: [...d.events, ...events],
      cycles: [...d.cycles, nextCycle(d.cycles[d.cycles.length - 1], d.config)],
    }),
    replaceGame: next => setData(next),
    resetToDemo: () => setData(demoGame()),
    setConfig: config => setData(d => d && { ...d, config }),
    moveBoss: (id, dir) => setData(d => {
      if (!d) return d
      const i = d.bosses.findIndex(b => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.bosses.length) return d
      const bosses = [...d.bosses]
      ;[bosses[i], bosses[j]] = [bosses[j], bosses[i]]
      return { ...d, bosses }
    }),
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
