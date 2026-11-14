import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import EventForm from '../components/EventForm'
import ProgressBar from '../components/ProgressBar'
import { formatDate } from '../lib/dates'
import { db, type Category, type EventItem, type Subtask } from '../lib/db'
import { archiveExpired } from '../lib/events'
import { useCategories } from '../lib/hooks'
import { eventProgress } from '../lib/progress'

const TYPE_EMOJI = { project: '🎯', appointment: '📅', savings: '💰' } as const
const NO_COLOR = '#64748b'

export function EventCard({
  event,
  subtasks,
  category,
}: {
  event: EventItem
  subtasks: Subtask[]
  category?: Category
}) {
  const progress = eventProgress(event, subtasks)
  const color = category?.color ?? NO_COLOR

  return (
    <Link
      to={`/ereignisse/${event.id}`}
      className="card block border-l-4 transition-shadow hover:shadow-md"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{TYPE_EMOJI[event.type]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-semibold">{event.title}</h3>
            {event.due_date && (
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{formatDate(event.due_date)}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{progress.label}</p>
          {progress.ratio !== null && (
            <div className="mt-2">
              <ProgressBar ratio={progress.ratio} color={color} />
            </div>
          )}
          {category && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {category.emoji} {category.name}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

/** Sortiert nach Datum (früheste zuerst), Einträge ohne Datum ans Ende */
function byDueDate(a: EventItem, b: EventItem) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date) return -1
  if (b.due_date) return 1
  return a.created_at.localeCompare(b.created_at)
}

export default function EventsPage() {
  const categories = useCategories()
  const data = useLiveQuery(async () => {
    const events = (await db().events.toArray()).filter((e) => !e.deleted_at)
    const subtasks = (await db().subtasks.toArray()).filter((s) => !s.deleted_at)
    const byEvent = new Map<string, Subtask[]>()
    for (const s of subtasks) byEvent.set(s.event_id, [...(byEvent.get(s.event_id) ?? []), s])
    return { events, byEvent }
  })
  const [filter, setFilter] = useState<string>('all')
  const [creating, setCreating] = useState(false)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    void archiveExpired()
  }, [])

  if (!data || !categories) return <p className="text-sm text-slate-500">Lädt …</p>

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const matches = (e: EventItem) =>
    filter === 'all' || (filter === 'none' ? !e.category_id || !categoryById.has(e.category_id) : e.category_id === filter)

  const active = data.events.filter((e) => e.status === 'active' && matches(e)).sort(byDueDate)
  const done = data.events
    .filter((e) => e.status !== 'active' && matches(e))
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

  const chip = (value: string, label: string, color?: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${
        filter === value
          ? 'border-transparent bg-indigo-600 text-white'
          : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
      }`}
      style={filter === value && color ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {chip('all', 'Alle')}
        {categories.map((c) => chip(c.id, `${c.emoji} ${c.name}`, c.color))}
        {chip('none', 'Ohne Kategorie')}
      </div>

      <button type="button" className="btn btn-primary w-full md:w-auto" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4" /> Neues Ereignis
      </button>

      {active.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {data.events.length === 0
            ? 'Noch keine Ereignisse. Leg dein erstes Vorhaben, einen Termin oder ein Sparziel an.'
            : 'Keine laufenden Ereignisse in dieser Auswahl.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {active.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              subtasks={data.byEvent.get(e.id) ?? []}
              category={e.category_id ? categoryById.get(e.category_id) : undefined}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <button type="button" className="btn btn-ghost px-2" onClick={() => setShowDone(!showDone)}>
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Erledigt ({done.length})
          </button>
          {showDone && (
            <div className="mt-2 grid gap-3 opacity-70">
              {done.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  subtasks={data.byEvent.get(e.id) ?? []}
                  category={e.category_id ? categoryById.get(e.category_id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {creating && <EventForm onClose={() => setCreating(false)} />}
    </div>
  )
}
