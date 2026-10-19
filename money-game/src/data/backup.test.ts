import { describe, expect, it } from 'vitest'
import { exportJson, parseBackup } from './backup'
import { demoGame } from './model'
import { computeState } from '../engine/engine'

describe('backup', () => {
  it('round-trips the demo game with identical engine output', () => {
    const g = demoGame()
    const back = parseBackup(exportJson(g))
    expect(back).toEqual(g)
    expect(computeState(back).totalXp).toBe(computeState(g).totalXp)
    expect(computeState(g).gameNightStreak).toBe(3)
  })
  it('rejects junk', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/)
    expect(() => parseBackup('{"version":2}')).toThrow(/version/)
  })
})
