import { db, type TableMap, type TableName } from './db'
import { requestSync } from './sync'

/**
 * Alle Schreibzugriffe laufen über diese Funktionen: erst lokal speichern,
 * dann in die Outbox eintragen. Der Sync lädt die Änderung hoch, sobald Netz da ist.
 */

function keyOf<T extends TableName>(table: T, row: TableMap[T]): string {
  return table === 'settings' ? row.user_id : (row as { id: string }).id
}

/** Grundfelder für einen neuen Datensatz */
export function baseFields() {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    user_id: db().userId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
}

/** Legt einen Datensatz an oder überschreibt ihn. */
export async function saveRow<T extends TableName>(table: T, row: TableMap[T]) {
  const d = db()
  const stamped = { ...row, updated_at: new Date().toISOString() }
  await d.transaction('rw', d.table(table), d.outbox, async () => {
    await d.table(table).put(stamped)
    await d.outbox.add({ table, key: keyOf(table, stamped) })
  })
  requestSync()
}

/** Ändert einzelne Felder eines vorhandenen Datensatzes. */
export async function updateRow<T extends TableName>(table: T, key: string, changes: Partial<TableMap[T]>) {
  const d = db()
  await d.transaction('rw', d.table(table), d.outbox, async () => {
    const existing = await d.table(table).get(key)
    if (!existing) return
    await d.table(table).put({ ...existing, ...changes, updated_at: new Date().toISOString() })
    await d.outbox.add({ table, key })
  })
  requestSync()
}

/** Löscht „weich“: Der Datensatz bleibt mit Löschdatum erhalten, damit die Löschung synchronisiert wird. */
export async function deleteRow<T extends TableName>(table: T, key: string) {
  await updateRow(table, key, { deleted_at: new Date().toISOString() } as Partial<TableMap[T]>)
}
