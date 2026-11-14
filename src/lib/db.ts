import Dexie, { type Table } from 'dexie'

// ---------------------------------------------------------------------------
// Datentypen (entsprechen den Tabellen in supabase/migrations/0001_init.sql)
// ---------------------------------------------------------------------------
interface SyncFields {
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at?: string
}

export interface Category extends SyncFields {
  id: string
  name: string
  emoji: string
  color: string
  sort_order: number
}

export type EventType = 'project' | 'appointment' | 'savings'
export type ProgressMode = 'checklist' | 'numeric' | 'time' | 'countdown'

export interface EventItem extends SyncFields {
  id: string
  category_id: string | null
  title: string
  type: EventType
  progress_mode: ProgressMode
  start_date: string | null
  due_date: string | null
  current_value: number | null
  target_value: number | null
  unit: string | null
  note: string | null
  source: 'manual' | 'calendar'
  calendar_uid: string | null
  status: 'active' | 'done' | 'archived'
  completed_at: string | null
}

export interface Subtask extends SyncFields {
  id: string
  event_id: string
  title: string
  done: boolean
  done_at: string | null
  sort_order: number
}

export interface Habit extends SyncFields {
  id: string
  category_id: string | null
  title: string
  frequency: 'daily' | 'weekly'
  times_per_week: number | null
  active: boolean
}

export interface HabitCheck extends SyncFields {
  id: string
  habit_id: string
  date: string
}

export interface InboxTask extends SyncFields {
  id: string
  title: string
  due_date: string | null
  done: boolean
  done_at: string | null
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings extends SyncFields {
  ical_url: string | null
  theme: Theme
  notify_evening: boolean
  notify_countdown: boolean
  notify_achievement: boolean
  notify_weekly: boolean
}

export interface TableMap {
  categories: Category
  events: EventItem
  subtasks: Subtask
  habits: Habit
  habit_checks: HabitCheck
  inbox_tasks: InboxTask
  settings: Settings
}
export type TableName = keyof TableMap

/**
 * Alle synchronisierten Tabellen. Die Reihenfolge ist wichtig: beim Hochladen
 * muss z. B. eine Kategorie vor dem Ereignis ankommen, das auf sie verweist.
 */
export const SYNC_TABLES: { name: TableName; pk: 'id' | 'user_id' }[] = [
  { name: 'categories', pk: 'id' },
  { name: 'events', pk: 'id' },
  { name: 'subtasks', pk: 'id' },
  { name: 'habits', pk: 'id' },
  { name: 'habit_checks', pk: 'id' },
  { name: 'inbox_tasks', pk: 'id' },
  { name: 'settings', pk: 'user_id' },
]

/** Warteschlange der lokalen Änderungen, die noch zu Supabase müssen */
export interface OutboxEntry {
  seq?: number
  table: TableName
  key: string
}

export interface MetaEntry {
  key: string
  value: string
}

export class MomentumDB extends Dexie {
  categories!: Table<Category, string>
  events!: Table<EventItem, string>
  subtasks!: Table<Subtask, string>
  habits!: Table<Habit, string>
  habit_checks!: Table<HabitCheck, string>
  inbox_tasks!: Table<InboxTask, string>
  settings!: Table<Settings, string>
  outbox!: Table<OutboxEntry, number>
  meta!: Table<MetaEntry, string>

  readonly userId: string

  constructor(userId: string) {
    // Eigene lokale Datenbank pro Konto, damit sich nichts vermischt
    super(`momentum-${userId}`)
    this.userId = userId
    this.version(1).stores({
      categories: 'id, sort_order',
      events: 'id, category_id, status, due_date, calendar_uid',
      subtasks: 'id, event_id',
      habits: 'id, category_id',
      habit_checks: 'id, habit_id, date',
      inbox_tasks: 'id, due_date',
      settings: 'user_id',
      outbox: '++seq, [table+key]',
      meta: 'key',
    })
  }
}

let current: MomentumDB | null = null

export function openDb(userId: string): MomentumDB {
  if (current?.userId !== userId) {
    current?.close()
    current = new MomentumDB(userId)
  }
  return current
}

export function closeDb() {
  current?.close()
  current = null
}

/** Die lokale Datenbank des angemeldeten Nutzers */
export function db(): MomentumDB {
  if (!current) throw new Error('Nicht angemeldet: lokale Datenbank ist nicht geöffnet')
  return current
}
