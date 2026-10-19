import Dexie, { type EntityTable } from 'dexie'
import type { GameData } from './model'

interface Doc { id: string; data: GameData }

const db = new Dexie('money-game') as Dexie & { docs: EntityTable<Doc, 'id'> }
db.version(1).stores({ docs: 'id' })

export async function loadGame(): Promise<GameData | null> {
  try { return (await db.docs.get('game'))?.data ?? null } catch { return null }
}

export async function saveGame(data: GameData): Promise<void> {
  try { await db.docs.put({ id: 'game', data }) } catch { /* storage unavailable: the game still runs in memory */ }
}
