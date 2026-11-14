import { deleteRow, updateRow } from './data'
import { today } from './dates'
import { db, type Subtask } from './db'
import { eventProgress } from './progress'

export async function subtasksOf(eventId: string): Promise<Subtask[]> {
  const rows = await db().subtasks.where('event_id').equals(eventId).toArray()
  return rows.filter((s) => !s.deleted_at).sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Prüft, ob ein Ereignis erledigt ist (Ziel erreicht, Checkliste komplett, Termin vorbei)
 * und verschiebt es ins Archiv „Erledigt“ bzw. holt es wieder zurück.
 */
export async function refreshEventStatus(eventId: string) {
  const event = await db().events.get(eventId)
  if (!event || event.deleted_at) return
  const { complete } = eventProgress(event, await subtasksOf(eventId))

  if (complete && event.status === 'active') {
    await updateRow('events', eventId, { status: 'done', completed_at: new Date().toISOString() })
  } else if (!complete && event.status === 'done') {
    await updateRow('events', eventId, { status: 'active', completed_at: null })
  }
}

/** Abgelaufene Termine und Zeiträume ins Archiv verschieben (läuft beim Öffnen der App). */
export async function archiveExpired() {
  const now = today()
  const expired = await db()
    .events.where('status')
    .equals('active')
    .filter(
      (e) =>
        !e.deleted_at &&
        (e.progress_mode === 'time' || e.progress_mode === 'countdown') &&
        e.due_date !== null &&
        e.due_date < now,
    )
    .toArray()
  for (const e of expired) await refreshEventStatus(e.id)
}

/** Löscht ein Ereignis samt seinen Unteraufgaben. */
export async function deleteEvent(eventId: string) {
  for (const s of await subtasksOf(eventId)) await deleteRow('subtasks', s.id)
  await deleteRow('events', eventId)
}
