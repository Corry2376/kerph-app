import { useRef, useState } from 'react'
import { useGame } from '../store'
import { Btn, Card, Field, H } from '../components/ui'
import { downloadBackup, parseBackup } from '../data/backup'
import Celebration from './Celebration'
import { sampleMoments } from '../fx/sampleMoments'
import { sfx } from '../fx/sound'
import type { XpConfig } from '../engine/types'

const XP_LABELS: Record<keyof XpConfig, string> = {
  gameNight: 'Review completed', laneUnderBudget: 'Budget under limit (each)', sweepPer10: 'Allocated, per $10',
  extraBossPer10: 'Extra debt payment, per $10', levelUp: 'Goal milestone reached', bossDefeated: 'Debt paid off',
  noSpendDay: 'No-spend day', bonusSplitFollowed: 'Windfall split followed', planUnderBudget: 'Event closed on budget',
}

export default function Settings({ onSetup }: { onSetup: () => void }) {
  const { data, state, setConfig, replaceGame, resetToDemo } = useGame()
  const [preview, setPreview] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const onImport = async (f?: File) => {
    if (!f) return
    try {
      const next = parseBackup(await f.text())
      if (!confirm('Replace the current game with this backup?')) return
      replaceGame(next)
      setMsg('Backup restored.')
    } catch (e) { setMsg((e as Error).message) }
    if (file.current) file.current.value = ''
  }

  return (
    <>
      {preview && <Celebration moments={sampleMoments(data, state)} bosses={data.bosses} quests={data.quests} onDone={() => setPreview(false)} />}
      <Card>
        <H>Recap preview</H>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">Plays every recap screen (payment, interest, milestone, streak, paid-off debt, closed event, achievement, summary) with sample numbers. Nothing is saved.</p>
        <Btn variant="ghost" onClick={() => { sfx('tick'); setPreview(true) }}>Preview recap</Btn>
      </Card>

      <Card>
        <H>Backup</H>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">Your game lives only in this browser. Export a backup after each review.</p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => downloadBackup(data)}>Export JSON</Btn>
          <Btn variant="ghost" onClick={() => file.current?.click()}>Import JSON</Btn>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => onImport(e.target.files?.[0])} />
        </div>
        {msg && <p role="status" className="mt-2 text-sm font-semibold">{msg}</p>}
      </Card>

      <Card>
        <H>Rules</H>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm"><span className="mb-1 block font-medium">Pay cycle</span>
            <select value={data.config.payCycle} onChange={e => setConfig({ ...data.config, payCycle: e.target.value as 'weekly' | 'biweekly' })}
              className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900">
              <option value="weekly">Every Friday</option><option value="biweekly">Every other Friday</option>
            </select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Payoff order</span>
            <select value={data.config.bossOrder} onChange={e => setConfig({ ...data.config, bossOrder: e.target.value as 'snowball' | 'avalanche' })}
              className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-900">
              <option value="snowball">Smallest balance first</option><option value="avalanche">Highest rate first</option>
            </select></label>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Boss order applies to new setups; reorder the live queue in the Debts tab. Cycle length applies from the next cycle.</p>
        <h3 className="mb-2 mt-4 font-bold">Point values</h3>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(XP_LABELS) as (keyof XpConfig)[]).map(k => (
            <Field key={k} label={XP_LABELS[k]} type="number" min={0} inputMode="numeric" value={data.config.xp[k]}
              onChange={e => setConfig({ ...data.config, xp: { ...data.config.xp, [k]: Math.max(0, Number(e.target.value) || 0) } })} />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Changing point values re-scores the whole history. Players: {data.players.map(p => p.name).join(' & ')}.</p>
      </Card>

      <Card>
        <H>Game</H>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={onSetup}>Run setup wizard</Btn>
          <Btn variant="danger" onClick={() => { if (confirm('Replace everything with fake demo data?')) resetToDemo() }}>Reset to demo</Btn>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Cards are stored by nickname and last four digits only. No bank logins or account numbers, ever.</p>
      </Card>
    </>
  )
}
