const PATHS = {
  hq: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  night: 'M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 14l2 2 4-4',
  boss: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 1v5 M12 18v5 M1 12h5 M18 12h5',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14',
  lanes: 'M12 3l9 5-9 5-9-5z M3 12.5l9 5 9-5',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H4v1a3 3 0 0 0 4 3 M16 6h4v1a3 3 0 0 1-4 3 M12 13v4 M8 21h8 M10 17h4',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M9 4v4 M15 10v4 M8 16v4',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  soundOn: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
  soundOff: 'M4 9v6h4l5 4V5L8 9z M17 9l5 6 M22 9l-5 6',
  check: 'M5 12l5 5L20 7',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v10 M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.8 2.5 1.8-1 1.4-2.5 1.7-2.5.7-2.5 1.8 1 1.7 2.5 1.7 2.5-.5 2.5-1.5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  up: 'M12 20V5 M6 11l6-6 6 6',
  plus: 'M12 5v14 M5 12h14',
  skull: 'M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z M9 12h.01 M15 12h.01 M10 20v-2 M14 20v-2',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {PATHS[name].split(' M').map((d, i) => <path key={i} d={i === 0 ? d : `M${d}`} />)}
    </svg>
  )
}
