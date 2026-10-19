/**
 * Announcer lines, one pool per event type. Placeholders in {braces}. Always the real number,
 * never shaming. A pool has 10+ lines so the picker can avoid repeating the last three.
 */
export type MessageType =
  | 'gameNight' | 'bossHit' | 'bossHeal' | 'bossDefeated' | 'levelUp' | 'laneUnder' | 'streakMilestone'
  | 'missedWeek' | 'sweep' | 'extraDamage' | 'noSpendDay' | 'bonusSplit' | 'achievement' | 'seasonFinale'

export const MESSAGE_VARS: Record<MessageType, string[]> = {
  gameNight: ['streak', 'multiplier', 'xp'],
  bossHit: ['amount', 'boss', 'hp'],
  bossHeal: ['boss', 'interest'],
  bossDefeated: ['boss', 'payment', 'nextBoss'],
  levelUp: ['level', 'quest', 'remaining'],
  laneUnder: ['lane', 'amount'],
  streakMilestone: ['streak', 'multiplier'],
  missedWeek: ['xp'],
  sweep: ['amount', 'dest'],
  extraDamage: ['amount', 'boss'],
  noSpendDay: ['days'],
  bonusSplit: ['amount'],
  achievement: ['name'],
  seasonFinale: ['n', 'levels', 'damage', 'reward'],
}

export const MESSAGE_POOLS: Record<MessageType, string[]> = {
  gameNight: [
    'Check-in complete. Week {streak} of the streak, and the multiplier sits at {multiplier}x.',
    'Game night banked: {xp} XP. The streak holds at {streak}.',
    "That's {xp} XP on the board. Week {streak}, multiplier {multiplier}x.",
    'Another one in the books. Streak: {streak}. Payout: {xp} XP.',
    'Five minutes well spent. {xp} XP added at {multiplier}x.',
    'Logged and locked. Week {streak} is yours, worth {xp} XP.',
    'The scorekeeper signs off: {xp} XP, streak at {streak}.',
    'Clean check-in. Streak {streak}, multiplier {multiplier}x, {xp} XP.',
    'Week {streak} complete. The team earns {xp} XP.',
    'Numbers updated, points awarded. {xp} XP for week {streak}.',
    'On the board: {xp} XP. The streak stands at {streak}.',
    'Game night done. {xp} XP at a {multiplier}x multiplier.',
  ],
  bossHit: [
    '{amount} of damage. {boss} staggers, down to {hp} health.',
    'Direct hit for {amount}. {boss} has {hp} left.',
    '{boss} takes {amount} and drops to {hp}.',
    'That landed: {amount} off {boss}. {hp} to go.',
    '{amount} in a single round. {boss} is at {hp}.',
    '{boss} feels that one. {amount} gone, {hp} remaining.',
    'Clean strike, {amount}. {boss} is down to {hp}.',
    'The attack connects for {amount}. {boss} holds at {hp}.',
    '{amount} knocked off {boss}. Health now {hp}.',
    'Solid round. {boss} loses {amount} and sits at {hp}.',
    '{boss} gives ground: {amount} down, {hp} to go.',
    'Another {amount} chipped away. {boss} is at {hp}.',
  ],
  bossHeal: [
    '{boss} regenerated {interest} from interest. Hit it harder next week.',
    'Interest fed {boss} another {interest}. Next round, push back.',
    '{boss} recovered {interest}. That is what interest does.',
    '{interest} crept back onto {boss}. Worth pressing harder.',
    '{boss} drew {interest} in interest. The next attack can outrun it.',
    'A small recovery for {boss}: {interest}. Keep the pressure on.',
    '{boss} healed {interest}. Every extra dollar shrinks that.',
    'Interest added {interest} to {boss}. Time to out-damage it.',
    '{boss} patched itself up by {interest}. Stay on it.',
    '{interest} of regeneration for {boss}. The next hit settles it.',
  ],
  bossDefeated: [
    '{boss} has fallen. Its {payment} attack power now joins the fight against {nextBoss}.',
    '{boss} is down for good. {payment} of firepower moves on to {nextBoss}.',
    'Victory over {boss}. That {payment} a cycle now points at {nextBoss}.',
    '{boss} is finished. Its {payment} rolls forward against {nextBoss}.',
    'It is over for {boss}. {payment} of attack transfers to {nextBoss}.',
    '{boss} goes to the trophy room. {payment} per cycle now targets {nextBoss}.',
    'Final blow on {boss}. The freed {payment} swings toward {nextBoss}.',
    '{boss} defeated. Next in line: {nextBoss}, facing {payment} of added power.',
    'The last of {boss} is gone. {payment} a cycle carries over to {nextBoss}.',
    '{boss} cleared. Its {payment} attack is now aimed at {nextBoss}.',
  ],
  levelUp: [
    'Level {level} of {quest} cleared. {remaining} to go.',
    '{quest} reaches level {level}. {remaining} left to the goal.',
    'Level {level} unlocked on {quest}, with {remaining} still ahead.',
    '{quest} moves up to level {level}. {remaining} to finish.',
    'Another level down: {quest} is at {level}, {remaining} from the top.',
    'Level {level} done for {quest}. The goal is {remaining} away.',
    '{quest} climbs to level {level}. {remaining} remains.',
    'Milestone on {quest}: level {level}. {remaining} to go.',
    'You cleared level {level} of {quest}. {remaining} left.',
    '{quest}, level {level}. Only {remaining} stands between you and the goal.',
  ],
  laneUnder: [
    '{lane} came in {amount} under. Sweep it and cash in.',
    '{lane} finished {amount} under budget. That is yours to sweep.',
    'Under budget in {lane} by {amount}. Put it to work.',
    '{lane} left {amount} on the table. Sweep it toward a goal.',
    '{amount} to spare in {lane}. Time to sweep.',
    '{lane} closed {amount} under. Points for that, and dollars to move.',
    'Well inside the {lane} budget: {amount} remaining.',
    '{lane} has {amount} left over. Ready to sweep.',
    '{amount} saved in {lane} by simply staying inside the lines.',
    '{lane} lane: {amount} under. Nice and tidy.',
  ],
  streakMilestone: [
    '{streak} weeks straight. That is a {multiplier}x multiplier now in effect.',
    'Streak at {streak}. Every point now counts {multiplier}x.',
    '{streak} in a row unlocks a {multiplier}x multiplier.',
    'Week {streak} and the multiplier steps up to {multiplier}x.',
    'The streak reaches {streak}. Multiplier: {multiplier}x.',
    '{streak} consecutive game nights. Your points now multiply by {multiplier}.',
    'Consistency pays: {streak} weeks, {multiplier}x.',
    'Streak milestone at {streak}. {multiplier}x from here.',
    '{streak} weeks without a miss. The multiplier is now {multiplier}x.',
    'Threshold crossed at week {streak}. Enjoy the {multiplier}x.',
  ],
  missedWeek: [
    'Streak reset, but every point you earned is still yours. The comeback starts tonight.',
    'A week slipped by. All {xp} lifetime XP stays, and a new streak begins now.',
    'Streak back to one, points untouched. Welcome back.',
    'Missed week logged, nothing taken away. Tonight is the restart.',
    'The streak resets, the score does not. Back in the game.',
    'No points lost. A fresh streak begins with tonight.',
    'Last week got away. The XP is safe, and the comeback is on.',
    'Streak restarted. Everything you earned still counts.',
    'A pause, not a penalty. Streak starts over tonight.',
    'Back at the table. Your points are intact and the streak restarts here.',
  ],
  sweep: [
    '{amount} swept into {dest}. Leftovers turned into progress.',
    'Swept {amount} to {dest}. Nothing left on the table.',
    '{amount} moves from your lanes to {dest}.',
    'Lane leftovers of {amount} go straight to {dest}.',
    '{amount} swept. {dest} gets the benefit.',
    'The sweep sends {amount} to {dest}.',
    'Clean sweep of {amount}, headed for {dest}.',
    '{amount} of unspent budget now works for {dest}.',
    'Swept {amount} toward {dest}. Every dollar earns XP.',
    '{dest} receives {amount} from the sweep.',
  ],
  extraDamage: [
    '{amount} of extra damage on {boss}, beyond autopilot.',
    'Bonus attack: {amount} more against {boss}.',
    'Above and beyond: {amount} extra into {boss}.',
    '{boss} takes an additional {amount} on top of the plan.',
    'Extra payment of {amount} lands on {boss}.',
    '{amount} past the autopilot attack. {boss} notices.',
    'Going beyond the schedule: {amount} more at {boss}.',
    'Surplus damage of {amount} hits {boss}.',
    '{amount} of unscheduled firepower aimed at {boss}.',
    'An extra {amount} for {boss}. That earns bonus XP.',
  ],
  noSpendDay: [
    '{days} logged. Quiet days add up.',
    'You logged {days}. Every one earns XP.',
    '{days} on the board. Restraint pays.',
    'Credit for {days}. Small wins, real points.',
    '{days} recorded this cycle.',
    '{days} counted. That is XP for staying put.',
    'Logged: {days}. The wallet thanks you.',
    '{days} earn their points tonight.',
    'Nice discipline: {days}.',
    'Points awarded for {days}.',
  ],
  bonusSplit: [
    'Bonus round handled by the plan: {amount} split as agreed.',
    'The agreed split was followed on {amount}. Bonus XP earned.',
    '{amount} windfall, divided exactly as planned.',
    'Windfall of {amount} put to work the agreed way.',
    'Plan followed on {amount}. Boss, quests and fun all got their share.',
    '{amount} divided by the book. Bonus XP is yours.',
    'The {amount} windfall went where you said it would.',
    'Split honored on {amount}. That is a bonus-round win.',
    '{amount} handled with discipline. Bonus points awarded.',
    'Bonus round complete: {amount}, split as agreed.',
  ],
  achievement: [
    'Achievement unlocked: {name}.',
    '{name} is yours. Added to the trophy room.',
    'New badge earned: {name}.',
    'You earned {name}. Check the trophy room.',
    '{name} unlocked.',
    'Trophy added: {name}.',
    'Badge secured: {name}.',
    '{name}. One for the collection.',
    'A new honor: {name}.',
    '{name} achieved. Well earned.',
  ],
  seasonFinale: [
    'Season {n} final: {levels} levels cleared, {damage} boss damage. Reward unlocked: {reward}.',
    'Season {n} is in the books. {levels} levels, {damage} of damage, and {reward} unlocked.',
    'Final tally for season {n}: {levels} levels and {damage} dealt. Enjoy {reward}.',
    'Season {n} complete. {levels} levels cleared, {damage} in damage. {reward} is yours.',
    'That is a wrap on season {n}: {levels} levels, {damage} damage, reward: {reward}.',
    'Season {n} results: {levels} levels, {damage} boss damage. {reward} unlocked.',
    'The whistle blows on season {n}. {levels} levels, {damage}, and {reward}.',
    'Season {n} closes with {levels} levels and {damage} dealt. Reward: {reward}.',
    'Season {n}, final score. {levels} levels, {damage}, {reward} earned.',
    'Season {n} wrapped: {levels} levels, {damage} damage, {reward} unlocked.',
  ],
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export type Picker = (type: MessageType, vars: Record<string, string | number>) => string

/** Random line from the pool that was not used in the last three picks of that type. */
export function createPicker(rng: () => number = Math.random): Picker {
  const recent = new Map<MessageType, number[]>()
  return (type, vars) => {
    const pool = MESSAGE_POOLS[type]
    const last = recent.get(type) ?? []
    const choices = pool.map((_, i) => i).filter(i => !last.includes(i))
    const idx = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))]
    recent.set(type, [...last, idx].slice(-3))
    return fill(pool[idx], vars)
  }
}

/** The one picker the app shares, so repeats are avoided across a whole session. */
export const pickMessage: Picker = createPicker()
