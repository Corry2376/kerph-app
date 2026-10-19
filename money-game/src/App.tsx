import { useState } from 'react'
import { useGame } from './store'
import { Btn } from './components/ui'
import { Icon, type IconName } from './components/Icon'
import { isMuted, setMuted } from './fx/sound'
import HQ from './screens/HQ'
import GameNight from './screens/GameNight'
import BossArena from './screens/BossArena'
import Lanes from './screens/Lanes'
import MapScreen from './screens/MapScreen'
import Trophies from './screens/Trophies'
import Settings from './screens/Settings'
import Setup from './screens/Setup'

export type Tab = 'hq' | 'night' | 'boss' | 'map' | 'lanes' | 'trophies' | 'settings'
const TABS: [Exclude<Tab, 'settings'>, IconName, string][] = [
  ['hq', 'hq', 'HQ'], ['night', 'night', 'Game night'], ['boss', 'boss', 'Boss'], ['map', 'map', 'Map'], ['lanes', 'lanes', 'Lanes'], ['trophies', 'trophy', 'Trophies'],
]

export default function App() {
  const { data } = useGame()
  const [tab, setTab] = useState<Tab>('hq')
  const [setup, setSetup] = useState(false)
  const [muted, setMutedState] = useState(isMuted)

  if (setup) return <Setup onDone={() => { setSetup(false); setTab('hq') }} onCancel={() => setSetup(false)} />

  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-24">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-bold tracking-tight">Money Game</h1>
        <div className="flex gap-1">
          <button onClick={() => { setMuted(!muted); setMutedState(!muted) }} aria-pressed={muted} aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="flex size-10 items-center justify-center rounded-md text-zinc-500 hover:bg-stone-200 dark:hover:bg-zinc-800"><Icon name={muted ? 'soundOff' : 'soundOn'} /></button>
          <button onClick={() => setTab('settings')} aria-label="Commissioner settings" aria-current={tab === 'settings' ? 'page' : undefined}
            className={`flex size-10 items-center justify-center rounded-md hover:bg-stone-200 dark:hover:bg-zinc-800 ${tab === 'settings' ? 'text-amber-600' : 'text-zinc-500'}`}><Icon name="settings" /></button>
        </div>
      </header>
      {data.isDemo && (
        <div className="flex items-center justify-between gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
          <span>Demo data. Nothing here is real.</span>
          <Btn variant="ghost" className="min-h-9 !py-1 text-sm" onClick={() => setSetup(true)}>Set up my game</Btn>
        </div>
      )}
      <main className="space-y-4 p-4">
        {tab === 'hq' && <HQ go={setTab} />}
        {tab === 'night' && <GameNight go={setTab} />}
        {tab === 'boss' && <BossArena />}
        {tab === 'map' && <MapScreen />}
        {tab === 'lanes' && <Lanes />}
        {tab === 'trophies' && <Trophies />}
        {tab === 'settings' && <Settings onSetup={() => setSetup(true)} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map(([id, icon, label]) => (
            <li key={id} className="flex-1">
              <button onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] ${tab === id ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-zinc-500'}`}>
                <Icon name={icon} />{label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
