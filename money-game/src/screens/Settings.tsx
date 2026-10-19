import { useRef, useState } from 'react'
import { useGame } from '../store'
import { Btn, Card, Field, H } from '../components/ui'
import { downloadBackup, parseBackup } from '../data/backup'
import type { XpConfig } from '../engine/types'

const XP_LABELS: Record<keyof XpConfig, string> = {
  gameNight: 'Game night completed', laneUnderBudget: 'Lane under budget (each)', sweepPer10: 'Swept, per $10',
  extraBossPer10: 'Extra boss damage, per $10', levelUp: 'Quest level cleared', bossDefeated: 'Boss defeated',
  noSpendDay: 'No-spend day', bonusSplitFollowed: 'Bonus split followed',
}

export default function Settings({ onSetup }: { onSetup: () => void }) {
  const { data, setConfig, replaceGame, resetToDemo } = useGame()
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
      <Card>
        <H>Backup</H>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Your game lives only in this browser. Export a backup after each game night.</p>
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
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-900">
              <option value="weekly">Every Friday</option><option value="biweekly">Every other Friday</option>
            </select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Boss order</span>
            <select value={data.config.bossOrder} onChange={e => setConfig({ ...data.config, bossOrder: e.target.value as 'snowball' | 'avalanche' })}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-600 dark:bg-slate-900">
              <option value="snowball">Snowball (smallest first)</option><option value="avalanche">Avalanche (highest rate)</option>
            </select></label>
        </div>
        <p className="mt-1 text-xs text-slate-500">Boss order applies to new setups; reorder the live queue in the Boss tab. Cycle length applies from the next cycle.</p>
        <h3 className="mb-2 mt-4 font-bold">XP values</h3>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(XP_LABELS) as (keyof XpConfig)[]).map(k => (
            <Field key={k} label={XP_LABELS[k]} type="number" min={0} inputMode="numeric" value={data.config.xp[k]}
              onChange={e => setConfig({ ...data.config, xp: { ...data.config.xp, [k]: Math.max(0, Number(e.target.value) || 0) } })} />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Changing XP values re-scores the whole history. Players: {data.players.map(p => p.name).join(' & ')}.</p>
      </Card>

      <Card>
        <H>Game</H>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={onSetup}>Run setup wizard</Btn>
          <Btn variant="danger" onClick={() => { if (confirm('Replace everything with fake demo data?')) resetToDemo() }}>Reset to demo</Btn>
        </div>
        <p className="mt-2 text-xs text-slate-500">Cards are stored by nickname and last four digits only. No bank logins or account numbers, ever.</p>
      </Card>
    </>
  )
}
