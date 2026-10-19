import type { GameData } from './model'

export function exportJson(data: GameData): string {
  return JSON.stringify(data, null, 2)
}

export function downloadBackup(data: GameData) {
  const blob = new Blob([exportJson(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `money-game-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Throws a readable Error if the file isn't a Money Game backup. */
export function parseBackup(text: string): GameData {
  let d: any
  try { d = JSON.parse(text) } catch { throw new Error('That file is not valid JSON.') }
  if (!d || d.version !== 1) throw new Error('That file is not a Money Game backup (wrong or missing version).')
  for (const k of ['players', 'quests', 'bosses', 'lanes', 'cycles', 'events'] as const)
    if (!Array.isArray(d[k])) throw new Error(`Backup is missing "${k}".`)
  if (!d.config?.xp || !Array.isArray(d.config.streakMultipliers)) throw new Error('Backup is missing config.')
  if (d.cycles.length === 0) throw new Error('Backup has no cycles.')
  const cycleIds = new Set(d.cycles.map((c: any) => c.id))
  if (d.events.some((e: any) => !cycleIds.has(e.cycleId))) throw new Error('Backup has events for unknown cycles.')
  return d as GameData
}
