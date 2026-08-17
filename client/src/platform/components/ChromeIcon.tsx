export type ChromeIconName =
  | 'settings'
  | 'chat'
  | 'phone'
  | 'phoneActive'
  | 'close'
  | 'back'
  | 'install'
  | 'sound'
  | 'rules'
  | 'stats'
  | 'history'
  | 'home'
  | 'leave'
  | 'mic'
  | 'micOff';

export function ChromeIcon({ name }: { name: ChromeIconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3.1" /><path d="M19.2 13.2a7.6 7.6 0 0 0 .05-2.4l2-1.55-2-3.45-2.45.98a8 8 0 0 0-2.05-1.2L14.4 3h-4.8l-.35 2.58a8 8 0 0 0-2.05 1.2L4.75 5.8l-2 3.45 2 1.55a7.6 7.6 0 0 0 .05 2.4l-2.05 1.55 2 3.45 2.48-.98a8 8 0 0 0 2.02 1.18L9.6 21h4.8l.35-2.6a8 8 0 0 0 2.02-1.18l2.48.98 2-3.45-2.05-1.55Z" /></svg>;
  if (name === 'chat') return <svg {...common}><path d="M5.2 18.2 3.6 21l3.45-1.25A9.2 9.2 0 1 0 3 12a8.9 8.9 0 0 0 2.2 6.2Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.5" /></svg>;
  if (name === 'phoneActive') return <svg {...common}><path d="M8.2 5.1c.65-.27 1.4.03 1.68.67l1.05 2.45c.25.58.04 1.26-.5 1.6l-1.38.9a14 14 0 0 0 4.25 4.25l.9-1.38c.35-.54 1.02-.75 1.6-.5l2.45 1.05c.64.28.94 1.03.67 1.68l-.74 1.78a2.1 2.1 0 0 1-2.2 1.27C10.2 18.05 5.95 13.8 5.13 8.03A2.1 2.1 0 0 1 6.4 5.83l1.8-.73Z" /><path d="M15.5 5.5a4.2 4.2 0 0 1 3 3M15.6 2.6a7.1 7.1 0 0 1 5.8 5.8" /></svg>;
  if (name === 'phone') return <svg {...common}><path d="M8.2 5.1c.65-.27 1.4.03 1.68.67l1.05 2.45c.25.58.04 1.26-.5 1.6l-1.38.9a14 14 0 0 0 4.25 4.25l.9-1.38c.35-.54 1.02-.75 1.6-.5l2.45 1.05c.64.28.94 1.03.67 1.68l-.74 1.78a2.1 2.1 0 0 1-2.2 1.27C10.2 18.05 5.95 13.8 5.13 8.03A2.1 2.1 0 0 1 6.4 5.83l1.8-.73Z" /></svg>;
  if (name === 'close') return <svg {...common}><path d="m7 7 10 10M17 7 7 17" /></svg>;
  if (name === 'back') return <svg {...common}><path d="m15 5-7 7 7 7" /></svg>;
  if (name === 'install') return <svg {...common}><path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M5 15v4h14v-4" /></svg>;
  if (name === 'sound') return <svg {...common}><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></svg>;
  if (name === 'rules') return <svg {...common}><path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12H7.5A2.5 2.5 0 0 1 5 16.5v-12Z" /><path d="M5 16.5A2.5 2.5 0 0 1 7.5 14H18M8 8h6M8 11h5" /></svg>;
  if (name === 'stats') return <svg {...common}><path d="M5 19V9m7 10V5m7 14v-7" /><path d="M3 19h18" /></svg>;
  if (name === 'history') return <svg {...common}><path d="M4.5 8.5A8 8 0 1 1 4 15" /><path d="M4.5 4.5v4h4M12 8v5l3 2" /></svg>;
  if (name === 'home') return <svg {...common}><path d="m4 11 8-6 8 6" /><path d="M6.5 10v9h11v-9M10 19v-5h4v5" /></svg>;
  if (name === 'leave') return <svg {...common}><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg>;
  if (name === 'micOff') return <svg {...common}><path d="m4 4 16 16M9.5 5.5A3 3 0 0 1 15 7v5a3 3 0 0 1-.4 1.5M8.2 13.8A3 3 0 0 1 8 12V7" /><path d="M5 11v1a7 7 0 0 0 11.4 5.4M19 11v1a7 7 0 0 1-.5 2.6M12 19v3M9 22h6" /></svg>;
  return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M9 22h6" /></svg>;
}
