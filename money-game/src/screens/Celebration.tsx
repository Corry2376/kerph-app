import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Boss, Quest } from '../engine/types'
import type { Moment } from '../engine/moments'
import { ACHIEVEMENTS } from '../engine/achievements'
import { DebtMark, type MarkPose } from '../components/DebtMark'
import { Icon, type IconName } from '../components/Icon'
import { Btn, ProgressBar, money } from '../components/ui'
import { burst } from '../fx/confetti'
import { sfx } from '../fx/sound'

const ICON: Partial<Record<Moment['kind'], IconName>> = {
  laneUnder: 'coin', sweep: 'coin', extraDamage: 'boss', planClosed: 'calendar', noSpendDay: 'calendar', bonusSplit: 'star',
  streakMilestone: 'flame', missedWeek: 'up', achievement: 'trophy', levelUp: 'up', gameNight: 'check',
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      setV(Math.round(to * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{v.toLocaleString('en-US')}</>
}

function Stage({ m, group, boss, quest }: { m: Moment; group: Moment[]; boss?: Boss; quest?: Quest }) {
  const [hp, setHp] = useState(m.hpBefore ?? 0)
  const [pose, setPose] = useState<MarkPose>('idle')

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)) }
    switch (m.kind) {
      case 'bossHit': sfx('hit'); at(350, () => { setHp(m.hpAfter ?? 0); setPose('payment') }); break
      case 'bossHeal': sfx('heal'); at(300, () => { setHp(m.hpAfter ?? 0); setPose('interest') }); break
      case 'bossDefeated': at(300, () => { setPose('cleared'); sfx('victory'); burst('medium') }); break
      case 'levelUp': sfx('level'); burst('medium'); break
      case 'achievement': sfx('achievement'); burst('small'); break
      case 'streakMilestone': sfx('streak'); break
      case 'laneUnder': case 'sweep': case 'bonusSplit': sfx('coin'); break
      case 'extraDamage': sfx('coin'); break
      case 'planClosed': sfx('achievement'); break
      case 'gameNight': sfx('achievement'); if ((m.multiplier ?? 1) > 1) burst('small'); break
      default: sfx('tick')
    }
    return () => timers.forEach(clearTimeout)
  }, [m])

  const isBoss = m.kind === 'bossHit' || m.kind === 'bossHeal' || m.kind === 'bossDefeated'
  const icon = ICON[m.kind]
  const heal = m.kind === 'bossHeal'

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">{m.label}</div>

      {isBoss && boss && (
        <div className="relative w-full max-w-xs">
          <div className="flex justify-center"><DebtMark seed={boss.artSeed} size={170} pose={pose} label={boss.cardNickname} /></div>
          {m.kind !== 'bossDefeated' && (
            <motion.div className={`absolute left-1/2 top-4 text-3xl font-semibold ${heal ? 'text-rose-400' : 'text-emerald-400'}`}
              initial={{ opacity: 0, y: 10, x: '-50%' }} animate={{ opacity: [0, 1, 1, 0], y: -34 }} transition={{ delay: heal ? 0.3 : 0.35, duration: 1.4 }}>
              {heal ? '+' : '-'}{money(m.amount ?? 0)}
            </motion.div>
          )}
          <p className="mt-2 text-lg font-semibold">{boss.cardNickname}</p>
          {m.kind === 'bossDefeated'
            ? <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">Paid off</p>
            : <div className="mx-auto mt-2 max-w-64"><ProgressBar value={hp} max={m.hpMax ?? 1} color="#a8514a" label="Remaining balance" height={14} />
              <p className="mt-1 text-sm text-zinc-300">{money(hp)} remaining</p></div>}
        </div>
      )}

      {m.kind === 'levelUp' && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
          <div className="mx-auto flex size-28 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400/10">
            <span className="font-serif text-5xl font-bold text-amber-300">{m.level}</span>
          </div>
          <p className="mt-3 text-lg font-semibold">{quest?.name ?? 'Quest'}</p>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Milestone reached</p>
        </motion.div>
      )}

      {m.kind === 'achievement' && (
        <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }}
          className="flex flex-col items-center">
          <div className="flex size-24 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400/10 text-amber-300"><Icon name="trophy" size={44} /></div>
          <p className="mt-3 font-serif text-2xl font-semibold">{ACHIEVEMENTS.find(a => a.key === m.achievementKey)?.name}</p>
          <p className="text-sm text-zinc-400">{ACHIEVEMENTS.find(a => a.key === m.achievementKey)?.description}</p>
        </motion.div>
      )}

      {m.kind === 'streakMilestone' && (
        <div className="flex flex-col items-center">
          <motion.div initial={{ scale: 0.7 }} animate={{ scale: [0.7, 1.25, 1.1] }} transition={{ duration: 0.7 }} className="text-amber-400"><Icon name="flame" size={72} /></motion.div>
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: 1, duration: 0.6, delay: 0.5 }}
            className="mt-3 rounded-md border border-amber-400 px-4 py-1 text-2xl font-semibold text-amber-300">{m.multiplier}x</motion.div>
          <p className="mt-2 text-sm text-zinc-400">{m.streak} week streak · bonus</p>
        </div>
      )}

      {m.kind === 'gameNight' && (
        <div className="w-full max-w-xs">
          <div className="font-serif text-6xl font-bold text-amber-300">+<CountUp to={m.xp ?? 0} /></div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Points earned</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-sm"><Icon name="flame" size={16} className="text-amber-400" /> Streak {m.streak} · bonus {m.multiplier}x</p>
          <ul className="mt-4 space-y-1 text-left text-sm text-zinc-300">
            {Object.entries(m.breakdown ?? {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-zinc-800 pb-1">
                <span>{({ gameNight: 'Review completed', lanes: 'Budgets under limit', sweep: 'Allocated', extraBoss: 'Extra payments', noSpend: 'No-spend days', bonusSplit: 'Windfall split', plans: 'Event closed on budget', levelUp: 'Goal milestones', bossDefeated: 'Debts paid off' } as Record<string, string>)[k]}</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.kind === 'laneUnder' && group.length > 1 && (
        <div className="w-full max-w-xs">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [0.8, 1.1, 1], opacity: 1 }} transition={{ duration: 0.5 }}
            className="mx-auto flex size-20 items-center justify-center rounded-full border-2 border-amber-400/70 bg-amber-400/10 text-amber-300"><Icon name="coin" size={34} /></motion.div>
          <ul className="mt-4 space-y-1 text-left text-sm">
            {group.map((g, k) => (
              <motion.li key={k} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + k * 0.12 }} className="flex justify-between border-b border-zinc-800 pb-1">
                <span>{g.subject}</span><span className="text-emerald-400">{money(g.amount ?? 0)} under</span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">{money(group.reduce((t, g) => t + (g.amount ?? 0), 0))} ready to sweep</p>
        </div>
      )}

      {!isBoss && !(m.kind === 'laneUnder' && group.length > 1) && !['levelUp', 'achievement', 'streakMilestone', 'gameNight'].includes(m.kind) && icon && (
        <div className="flex flex-col items-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [0.8, 1.1, 1], opacity: 1 }} transition={{ duration: 0.5 }}
            className="flex size-24 items-center justify-center rounded-full border-2 border-amber-400/70 bg-amber-400/10 text-amber-300">
            <Icon name={icon} size={40} />
          </motion.div>
          {m.amount !== undefined && (
            <p className="mt-3 font-serif text-4xl font-bold">{m.kind === 'noSpendDay' ? m.amount : money(m.amount)}</p>
          )}
        </div>
      )}

      <p aria-live="polite" className="mt-5 max-w-sm text-base leading-snug text-zinc-100">{m.message}</p>
    </div>
  )
}

export default function Celebration({ moments, bosses, quests, onDone }: { moments: Moment[]; bosses: Boss[]; quests: Quest[]; onDone: () => void }) {
  const [i, setI] = useState(0)
  // Lane results arrive one per lane; show them together on a single screen.
  const groups = moments.reduce<Moment[][]>((acc, x) => {
    const prev = acc[acc.length - 1]
    if (prev && x.kind === 'laneUnder' && prev[0].kind === 'laneUnder') prev.push(x)
    else acc.push([x])
    return acc
  }, [])
  const last = groups.length - 1
  const group = groups[i] ?? []
  const m = group[0]
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (i >= last) return
    const t = setTimeout(() => setI(n => n + 1), m.kind === 'bossDefeated' ? 4800 : 3400)
    return () => clearTimeout(t)
  }, [i, last, m.kind])

  const next = () => (i >= last ? done.current() : setI(n => n + 1))

  if (!m) return null
  return (
    <MotionConfig reducedMotion="user">
      <div role="dialog" aria-modal="true" aria-label="Review results" onClick={next}
        className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100">
        <div className="flex items-center justify-between p-4 text-xs text-zinc-500">
          <span>{i + 1} / {groups.length}</span>
          {i < last && <Btn variant="ghost" className="min-h-9 !px-3 !py-1 text-xs text-zinc-300" onClick={e => { e.stopPropagation(); setI(last) }}>Skip to summary</Btn>}
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              <Stage m={m} group={group} boss={bosses.find(b => b.id === m.bossId)} quest={quests.find(q => q.id === m.questId)} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Btn className="w-full" onClick={e => { e.stopPropagation(); next() }}>{i >= last ? 'Done' : 'Continue'}</Btn>
        </div>
      </div>
    </MotionConfig>
  )
}
