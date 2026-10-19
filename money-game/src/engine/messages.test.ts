import { describe, expect, it } from 'vitest'
import { MESSAGE_POOLS, MESSAGE_VARS, createPicker, fill, type MessageType } from './messages'

const types = Object.keys(MESSAGE_POOLS) as MessageType[]
const sample = (t: MessageType) => Object.fromEntries(MESSAGE_VARS[t].map(v => [v, `<${v}>`]))

describe('message pools', () => {
  it('covers every event type with at least 10 unique templates', () => {
    expect(types.sort()).toEqual([
      'achievement', 'bonusSplit', 'bossDefeated', 'bossHeal', 'bossHit', 'extraDamage', 'gameNight', 'laneUnder',
      'levelUp', 'missedWeek', 'noSpendDay', 'seasonFinale', 'streakMilestone', 'sweep',
    ])
    for (const t of types) {
      expect(MESSAGE_POOLS[t].length, t).toBeGreaterThanOrEqual(10)
      expect(new Set(MESSAGE_POOLS[t]).size, `${t} has duplicates`).toBe(MESSAGE_POOLS[t].length)
    }
  })

  it('only uses declared placeholders, and every declared one resolves', () => {
    for (const t of types) for (const tpl of MESSAGE_POOLS[t]) {
      const used = [...tpl.matchAll(/\{(\w+)\}/g)].map(m => m[1])
      for (const u of used) expect(MESSAGE_VARS[t], `${t}: {${u}}`).toContain(u)
      expect(fill(tpl, sample(t))).not.toMatch(/[{}]/)
    }
  })

  it('never shames: no template tells anyone off', () => {
    const banned = /\b(fail|failure|lazy|bad|shame|disappoint|worse|terrible|loser)\b/i
    for (const t of types) for (const tpl of MESSAGE_POOLS[t]) expect(tpl).not.toMatch(banned)
  })
})

describe('picker', () => {
  it('never repeats a message within the last three of the same event', () => {
    let seed = 7
    const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
    const pick = createPicker(rng)
    for (const t of types) {
      const out: string[] = []
      for (let i = 0; i < 300; i++) out.push(pick(t, sample(t)))
      for (let i = 0; i < out.length; i++)
        for (let k = 1; k <= 3 && i - k >= 0; k++) expect(out[i], `${t} @${i}`).not.toBe(out[i - k])
    }
  })

  it('keeps separate history per event type', () => {
    const pick = createPicker(() => 0)
    const a = pick('bossHit', sample('bossHit'))
    pick('levelUp', sample('levelUp'))
    expect(a).toContain('<amount>')
  })

  it('uses the real numbers it is given', () => {
    const m = createPicker(() => 0.3)('bossHit', { amount: '$250', boss: 'The Viper', hp: '$1,200' })
    expect(m).toMatch(/\$250|The Viper|\$1,200/)
    expect(m).not.toMatch(/[{}]/)
  })
})
