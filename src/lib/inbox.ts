import { baseFields, deleteRow, saveRow, updateRow } from './data'
import { db, type InboxTask } from './db'
import { refreshEventStatus, subtasksOf } from './events'

export async function addInboxTask(title: string, dueDate: string | null) {
  await saveRow('inbox_tasks', {
    ...baseFields(),
    title: title.trim(),
    due_date: dueDate,
    done: false,
    done_at: null,
  })
}

export async function toggleInboxTask(task: InboxTask) {
  await updateRow('inbox_tasks', task.id, {
    done: !task.done,
    done_at: task.done ? null : new Date().toISOString(),
  })
}

/** Macht aus einer losen Aufgabe eine Unteraufgabe in der Checkliste eines Ereignisses. */
export async function assignTaskToEvent(task: InboxTask, eventId: string) {
  const existing = await subtasksOf(eventId)
  const sort_order = Math.max(-1, ...existing.map((s) => s.sort_order)) + 1
  await saveRow('subtasks', {
    ...baseFields(),
    event_id: eventId,
    title: task.title,
    done: task.done,
    done_at: task.done_at,
    sort_order,
  })
  await deleteRow('inbox_tasks', task.id)
  await refreshEventStatus(eventId)
}

/** Ereignisse, die eine Checkliste haben können (Checkliste oder Termin) */
export async function assignableEvents() {
  const events = await db().events.where('status').equals('active').toArray()
  return events
    .filter((e) => !e.deleted_at && (e.progress_mode === 'checklist' || e.progress_mode === 'countdown'))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'))
}
