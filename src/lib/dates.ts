/** Datumsangaben sind einfache Texte im Format JJJJ-MM-TT (ohne Uhrzeit, ohne Zeitzone). */

import { daysBetween } from '../../supabase/functions/_shared/core.ts'

// Die Rechenfunktionen teilen sich App und Server
export { addDays, daysBetween, weekStart } from '../../supabase/functions/_shared/core.ts'

export function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function today(): string {
  return toDateString(new Date())
}

/** 2026-11-14 -> 14.11.2026 */
export function formatDate(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

/** 2026-11-14 -> 14.11. */
export function formatDayMonth(s: string): string {
  const [, m, d] = s.split('-')
  return `${d}.${m}.`
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
