import { motion } from 'framer-motion'
import { useGame } from '../store'
import { BossArt } from '../components/BossArt'
import { Icon } from '../components/Icon'
import { Card, H, ProgressBar, money } from '../components/ui'

const W = 340, H_ = 112

function QuestPath({ name, levels, cleared, fraction, complete }: { name: string; levels: number; cleared: number; fraction: number; complete: boolean }) {
  const pt = (k: number): [number, number] => [18 + k * (304 / levels), 56 + Math.sin(k * 0.85) * 22]
  const nodes = Array.from({ length: levels + 1 }, (_, k) => pt(k))
  const line = (arr: [number, number][]) => arr.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const here: [number, number] = (() => {
    if (cleared >= levels) return nodes[levels]
    const [x0, y0] = nodes[cleared], [x1, y1] = nodes[cleared + 1]
    return [x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction]
  })()
  const walked = [...nodes.slice(0, cleared + 1), ...(cleared < levels ? [here] : [])]

  return (
    <svg viewBox={`0 0 ${W} ${H_}`} className="w-full" role="img" aria-label={`${name}: level ${cleared} of ${levels}`}>
      <path d={line(nodes)} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />
      <motion.path d={line(walked)} fill="none" stroke="#c8963e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
      {nodes.map(([x, y], k) => {
        const reached = k <= cleared
        const goal = k === levels
        return (
          <g key={k}>
            <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 * k, type: 'spring', stiffness: 260, damping: 18 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              {goal
                ? <rect x={x - 7} y={y - 7} width={14} height={14} transform={`rotate(45 ${x} ${y})`} fill={reached ? '#c8963e' : 'none'} stroke={reached ? '#c8963e' : 'currentColor'} strokeOpacity={reached ? 1 : 0.5} strokeWidth={2} />
                : <circle cx={x} cy={y} r={k === 0 ? 4 : 7} fill={reached ? '#c8963e' : 'none'} stroke={reached ? '#c8963e' : 'currentColor'} strokeOpacity={reached ? 1 : 0.4} strokeWidth={2} />}
            </motion.g>
            {k > 0 && <text x={x} y={y + 22} textAnchor="middle" fontSize={9} fill="currentColor" opacity={reached ? 0.9 : 0.45}>{k}</text>}
          </g>
        )
      })}
      {!complete && (
        <motion.circle cx={here[0]} cy={here[1]} r={10} fill="none" stroke="#e7e2d6" strokeWidth={2}
          animate={{ r: [10, 13, 10], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2.2 }} />
      )}
    </svg>
  )
}

export default function MapScreen() {
  const { data, state } = useGame()
  return (
    <>
      <Card>
        <H>The road: bosses</H>
        <ol className="relative ml-3 space-y-4 border-l border-stone-300 pl-6 dark:border-zinc-700">
          {data.bosses.map(b => {
            const s = state.bosses.find(x => x.id === b.id)!
            const defeated = s.status === 'defeated'
            const active = b.id === state.activeBossId
            return (
              <li key={b.id} className="relative">
                <span className={`absolute -left-[34px] top-1 flex size-5 items-center justify-center rounded-full border-2 bg-stone-100 dark:bg-zinc-950 ${defeated ? 'border-emerald-600 text-emerald-600' : active ? 'border-amber-500 text-amber-500' : 'border-stone-400 text-stone-400 dark:border-zinc-600'}`}>
                  <Icon name={defeated ? 'check' : active ? 'boss' : 'lock'} size={12} />
                </span>
                <div className="flex items-center gap-3">
                  <div className={defeated ? 'opacity-30 grayscale' : active ? '' : 'opacity-60'}><BossArt seed={b.artSeed} size={52} label={b.cardNickname} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.cardNickname} <span className="font-normal text-zinc-500">{b.rate}%</span></p>
                    {defeated
                      ? <p className="text-xs text-emerald-600">Gate open: defeated</p>
                      : <><ProgressBar value={s.currentBalance} max={b.startingBalance} color="#b4443c" label={b.cardNickname} height={8} />
                        <p className="mt-1 text-xs text-zinc-500">{money(s.currentBalance)} left{active ? ' · fighting now' : ''}</p></>}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      {data.quests.map(q => {
        const qs = state.quests.find(x => x.id === q.id)!
        const into = qs.currentAmount - qs.levelsCleared * qs.levelSize
        return (
          <Card key={q.id}>
            <div className="flex items-baseline justify-between">
              <H>{q.name}</H>
              <span className="text-sm text-zinc-500">Level {qs.levelsCleared} / {q.levelCount}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-200">
              <QuestPath name={q.name} levels={q.levelCount} cleared={qs.levelsCleared} fraction={qs.levelsCleared >= q.levelCount ? 1 : Math.max(0, Math.min(1, into / qs.levelSize))} complete={qs.complete} />
            </div>
            <p className="text-xs text-zinc-500">{money(qs.currentAmount)} of {money(q.targetAmount)} · {money(qs.levelSize)} per level · target {q.targetDate}</p>
          </Card>
        )
      })}
    </>
  )
}
