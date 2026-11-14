import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category } from './db'

/** Alle Kategorien (ohne gelöschte), sortiert. undefined, solange geladen wird. */
export function useCategories(): Category[] | undefined {
  return useLiveQuery(async () => (await db().categories.orderBy('sort_order').toArray()).filter((c) => !c.deleted_at))
}
