/** Tiny synthesized sound effects (no audio files). Muted state is remembered per device. */
const KEY = 'money-game-muted'
let ctx: AudioContext | null = null

export function isMuted(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
export function setMuted(m: boolean) {
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* private mode: just not remembered */ }
}

export type Sfx = 'hit' | 'heal' | 'level' | 'victory' | 'achievement' | 'streak' | 'coin' | 'tick'

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.06, slideTo?: number) {
  if (!ctx) return
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, ctx.currentTime + at)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + at + dur)
  g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + at)
  o.stop(ctx.currentTime + at + dur + 0.05)
}

export function sfx(kind: Sfx) {
  if (isMuted()) return
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { return }
  switch (kind) {
    case 'hit': tone(150, 0, 0.22, 'triangle', 0.12, 55); tone(90, 0, 0.18, 'square', 0.03, 40); break
    case 'heal': tone(330, 0, 0.25, 'sine', 0.05, 220); break
    case 'coin': tone(880, 0, 0.1, 'triangle', 0.05); tone(1320, 0.07, 0.16, 'triangle', 0.05); break
    case 'tick': tone(660, 0, 0.07, 'sine', 0.035); break
    case 'level': [392, 494, 587, 784].forEach((f, i) => tone(f, i * 0.09, 0.28, 'triangle', 0.06)); break
    case 'streak': tone(262, 0, 0.18, 'triangle', 0.06); tone(392, 0.12, 0.3, 'triangle', 0.06); break
    case 'achievement': tone(523, 0, 0.18, 'triangle', 0.06); tone(784, 0.14, 0.4, 'triangle', 0.06); break
    case 'victory': [262, 330, 392, 523, 392, 523, 659].forEach((f, i) => tone(f, i * 0.12, 0.34, 'triangle', 0.07)); break
  }
}
