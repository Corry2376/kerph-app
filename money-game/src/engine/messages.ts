/**
 * Plain-spoken status lines, one pool per event type. Placeholders in {braces}. Always the real number,
 * never shaming. A pool has 10+ lines so the picker can avoid repeating the last three.
 */
export type MessageType =
  | 'gameNight' | 'bossHit' | 'bossHeal' | 'bossDefeated' | 'levelUp' | 'laneUnder' | 'streakMilestone'
  | 'missedWeek' | 'sweep' | 'extraDamage' | 'noSpendDay' | 'bonusSplit' | 'achievement' | 'planClosed' | 'seasonFinale'

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
  planClosed: ['plan', 'result'],
  seasonFinale: ['n', 'levels', 'damage', 'reward'],
}

export const MESSAGE_POOLS: Record<MessageType, string[]> = {
  gameNight: [
    'Review complete. Week {streak} of your streak, bonus at {multiplier}x. {xp} points earned.',
    'Logged. {xp} points this cycle, and the streak holds at {streak}.',
    'Another review done. Streak: {streak}. Points added: {xp}.',
    '{xp} points banked at {multiplier}x. Week {streak} is on the record.',
    'Review saved. Streak at {streak}, {xp} points for the cycle.',
    'Week {streak} complete. That is {xp} points at a {multiplier}x bonus.',
    'Numbers are current. {xp} points earned, streak {streak}.',
    'Done in good time. {xp} points, bonus {multiplier}x, streak {streak}.',
    'On the books: week {streak}, {xp} points.',
    'Steady work. {xp} points added, streak at {streak}.',
    'Review closed. {xp} points at {multiplier}x.',
    'That is week {streak} handled. Points earned: {xp}.',
  ],
  bossHit: [
    '{amount} paid toward {boss}. {hp} remaining.',
    '{boss} is down {amount}, to {hp}.',
    'You put {amount} against {boss}. {hp} to go.',
    '{amount} applied to {boss}. Balance now {hp}.',
    '{boss}: {amount} paid, {hp} left.',
    'A solid {amount} toward {boss}. It stands at {hp}.',
    '{hp} left on {boss} after this {amount} payment.',
    'Progress on {boss}: {amount} off, {hp} remaining.',
    '{amount} reduces {boss} to {hp}.',
    'Payment of {amount} lands on {boss}. {hp} still owed.',
    '{boss} drops by {amount}. {hp} is what is left.',
    'Another {amount} off {boss}. The balance is {hp}.',
  ],
  bossHeal: [
    '{boss} accrued {interest} in interest. A bigger payment next cycle outpaces it.',
    'Interest added {interest} to {boss}. Extra principal is the best counter.',
    '{interest} of interest posted to {boss}.',
    '{boss} picked up {interest} in charges. Worth outrunning next cycle.',
    'Interest on {boss} this cycle: {interest}. It shrinks as the balance does.',
    '{interest} added to {boss} by interest. Keep the payments steady.',
    '{boss} grew by {interest}. Each extra dollar paid cuts into that.',
    'Interest charged: {interest} on {boss}. Hold the course.',
    '{boss} carries {interest} more from interest. The next payment covers it.',
    'Posted to {boss}: {interest} in interest.',
  ],
  bossDefeated: [
    '{boss} is paid off. Its {payment} a cycle now goes to {nextBoss}.',
    'Paid in full: {boss}. {payment} of payment power moves on to {nextBoss}.',
    '{boss} is cleared. That {payment} per cycle now works on {nextBoss}.',
    'Zero balance on {boss}. Its {payment} rolls forward to {nextBoss}.',
    '{boss} is behind you. {payment} a cycle is now aimed at {nextBoss}.',
    'One fewer card: {boss} is done. {payment} per cycle shifts to {nextBoss}.',
    '{boss} paid off. The freed {payment} carries over to {nextBoss}.',
    'Debt cleared: {boss}. Next focus is {nextBoss}, with {payment} added.',
    '{boss} has reached zero. {payment} per cycle goes to {nextBoss} from here.',
    'Finished with {boss}. {payment} of monthly power now backs {nextBoss}.',
  ],
  levelUp: [
    'Milestone {level} reached on {quest}. {remaining} to go.',
    '{quest} is at milestone {level}, with {remaining} left to the goal.',
    'Milestone {level} done for {quest}. {remaining} remains.',
    '{quest}: step {level} complete. {remaining} to finish.',
    'Another milestone on {quest}. Level {level}, {remaining} ahead.',
    '{quest} reaches milestone {level}. The goal is {remaining} away.',
    'You are at milestone {level} on {quest}. {remaining} still to fund.',
    'Milestone {level} cleared on {quest}. {remaining} left.',
    '{quest} moves to {level}. {remaining} is what is left.',
    'Progress on {quest}: milestone {level}. {remaining} to the finish.',
  ],
  laneUnder: [
    '{lane} finished {amount} under budget. That is available to allocate.',
    'You kept {lane} {amount} under. Put it to work.',
    '{lane} has {amount} left over this cycle.',
    '{amount} unspent in {lane}. Ready to move toward a goal.',
    '{lane} came in {amount} under budget.',
    'Under budget on {lane} by {amount}.',
    '{lane}: {amount} to spare.',
    '{amount} remains in {lane}. Good restraint.',
    '{lane} closed {amount} under. Worth allocating.',
    'Well within the {lane} budget: {amount} left.',
  ],
  streakMilestone: [
    '{streak} reviews in a row. Your bonus is now {multiplier}x.',
    'Streak at {streak}. Points now count {multiplier}x.',
    '{streak} consecutive weeks earns a {multiplier}x bonus.',
    'Week {streak}: the bonus steps up to {multiplier}x.',
    'The streak reaches {streak}. Bonus: {multiplier}x.',
    '{streak} weeks without a miss. Points now multiply by {multiplier}.',
    'Consistency pays: {streak} weeks, {multiplier}x.',
    'Streak milestone at {streak}. {multiplier}x from here.',
    '{streak} straight. The bonus is now {multiplier}x.',
    'Threshold crossed at week {streak}. Bonus {multiplier}x.',
  ],
  missedWeek: [
    'The streak restarts tonight. Everything you have earned stays.',
    'A week slipped by. Your {xp} points are intact, and a new streak begins now.',
    'Streak back to one, points untouched. Welcome back.',
    'Missed review noted, nothing taken away. This one restarts it.',
    'The streak resets, the score does not. Pick it up from here.',
    'No points lost. A fresh streak begins with this review.',
    'It happens. The points are safe and the streak starts again.',
    'Streak restarted. All earlier progress still counts.',
    'A pause, not a penalty. The streak starts over now.',
    'Back on track. Your points are intact and the streak restarts here.',
  ],
  sweep: [
    '{amount} allocated to {dest}. Leftovers put to use.',
    'Moved {amount} to {dest}. Nothing left idle.',
    '{amount} goes from your budgets to {dest}.',
    'Leftover {amount} now works for {dest}.',
    '{amount} allocated. {dest} gets the benefit.',
    'The leftovers, {amount}, go to {dest}.',
    '{amount} of unspent budget is now applied to {dest}.',
    'Allocated {amount} to {dest}. Every dollar earns points.',
    '{dest} receives {amount} from this cycle.',
    '{amount} redirected to {dest}.',
  ],
  extraDamage: [
    '{amount} extra paid on {boss}, beyond the plan.',
    'Above the schedule: {amount} more on {boss}.',
    'An additional {amount} toward {boss}.',
    '{boss} gets {amount} on top of the autopilot payment.',
    'Extra payment of {amount} applied to {boss}.',
    '{amount} past the scheduled payment on {boss}.',
    'Going beyond the plan: {amount} more toward {boss}.',
    'Surplus {amount} applied to {boss}.',
    '{amount} of unscheduled principal on {boss}.',
    'An extra {amount} for {boss}. That earns bonus points.',
  ],
  noSpendDay: [
    '{days} logged. Quiet days add up.',
    'You logged {days}. Each one earns points.',
    '{days} on the record. Restraint pays.',
    'Credit for {days}.',
    '{days} recorded this cycle.',
    '{days} counted toward your points.',
    'Logged: {days}.',
    '{days} earn their points.',
    'Good discipline: {days}.',
    'Points awarded for {days}.',
  ],
  bonusSplit: [
    'Windfall of {amount} handled by the plan, split as agreed.',
    'The agreed split was followed on {amount}. Bonus points earned.',
    '{amount} windfall, divided exactly as planned.',
    'Windfall of {amount} put to work the agreed way.',
    'Plan followed on {amount}: debt, goals and spending each got their share.',
    '{amount} divided as agreed. Bonus points are yours.',
    'The {amount} windfall went where you said it would.',
    'Split honored on {amount}. That earns bonus points.',
    '{amount} handled with discipline. Bonus points awarded.',
    'Windfall complete: {amount}, split as agreed.',
  ],
  achievement: [
    'Milestone unlocked: {name}.',
    '{name} is yours. It is on your record.',
    'New achievement: {name}.',
    'You earned {name}. See it on the record.',
    '{name} unlocked.',
    'Added to your record: {name}.',
    'Achievement secured: {name}.',
    '{name}. One for the record.',
    'A new achievement: {name}.',
    '{name} earned.',
  ],
  planClosed: [
    '{plan} wrapped up {result}.',
    '{plan} is closed, {result}.',
    'Event complete: {plan}, {result}.',
    '{plan} finished {result}. Points earned.',
    'You closed out {plan} {result}.',
    '{plan}: done, {result}.',
    'The {plan} budget held, {result}.',
    '{plan} came in {result}. Well planned.',
    'Closed {plan} {result}. That earns points.',
    '{plan} is behind you, {result}.',
  ],
  seasonFinale: [
    'Season {n} final: {levels} milestones, {damage} paid toward debt. Reward unlocked: {reward}.',
    'Season {n} is complete. {levels} milestones, {damage} in payments, and {reward} unlocked.',
    'Final tally for season {n}: {levels} milestones and {damage} paid. Enjoy {reward}.',
    'Season {n} closed. {levels} milestones cleared, {damage} paid. {reward} is yours.',
    'That is season {n}: {levels} milestones, {damage} paid, reward: {reward}.',
    'Season {n} results: {levels} milestones, {damage} toward debt. {reward} unlocked.',
    'Season {n} ends with {levels} milestones and {damage} paid. Reward: {reward}.',
    'Season {n}, final score: {levels} milestones, {damage}, {reward} earned.',
    'Season {n} wrapped: {levels} milestones, {damage} paid, {reward} unlocked.',
    'Season {n} in the books. {levels} milestones, {damage}, and {reward}.',
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
