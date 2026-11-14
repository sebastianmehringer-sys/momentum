import { supabase } from './supabase'
import { syncAndWait } from './sync'

export interface CalendarResult {
  added: number
  updated: number
  removed: number
  total: number
}

/** Stößt den Kalender-Abgleich auf dem Server an und holt danach die Änderungen ab. */
export async function syncCalendar(): Promise<CalendarResult> {
  if (!navigator.onLine) throw new Error('Dafür brauchst du eine Internetverbindung.')

  // Erst hochladen, damit der Server die aktuelle iCal-Adresse kennt
  await syncAndWait()

  const { data, error } = await supabase.functions.invoke('sync-calendar', { body: {} })
  if (error) {
    // Die Function schickt eine verständliche Meldung mit
    let message = 'Der Kalender konnte nicht abgeglichen werden.'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) message = body.error
    } catch {
      /* keine lesbare Antwort */
    }
    throw new Error(message)
  }

  await syncAndWait()
  return data as CalendarResult
}

export function describeResult(r: CalendarResult): string {
  const parts = [
    r.added > 0 ? `${r.added} neu` : null,
    r.updated > 0 ? `${r.updated} geändert` : null,
    r.removed > 0 ? `${r.removed} entfernt` : null,
  ].filter(Boolean)
  const changes = parts.length > 0 ? parts.join(', ') : 'keine Änderungen'
  return `${r.total} ${r.total === 1 ? 'Termin' : 'Termine'} im Kalender · ${changes}`
}
