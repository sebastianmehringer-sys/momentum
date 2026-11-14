/** Datumsangaben sind einfache Texte im Format JJJJ-MM-TT (ohne Uhrzeit, ohne Zeitzone). */

export function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function today(): string {
  return toDateString(new Date())
}

function utc(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Anzahl Tage von a bis b (negativ, wenn b vor a liegt) */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** 2026-11-14 -> 14.11.2026 */
export function formatDate(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

/** „noch 12 Tage“, „morgen“, „heute“, „vor 3 Tagen“ */
export function countdownLabel(due: string): string {
  const days = daysBetween(today(), due)
  if (days === 0) return 'heute'
  if (days === 1) return 'morgen'
  if (days > 1) return `noch ${days} Tage`
  if (days === -1) return 'gestern'
  return `vor ${-days} Tagen`
}
