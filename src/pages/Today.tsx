import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import Ring from '../components/Ring'
import { countdownLabel, formatDate, today } from '../lib/dates'
import { db, type EventItem, type Subtask } from '../lib/db'
import { archiveExpired } from '../lib/events'
import { useCategories } from '../lib/hooks'
import { eventProgress } from '../lib/progress'
import { habitState } from '../lib/streak'
import { HabitCard, useHabits } from './Habits'
import { TaskRow, useInboxTasks } from './Inbox'

const NO_COLOR = '#64748b'
const MAX_RINGS = 6
const MAX_COUNTDOWNS = 5

function Section({ title, link, children }: { title: string; link?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {link && (
          <Link to={link.to} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function byDueDate(a: EventItem, b: EventItem) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date) return -1
  if (b.due_date) return 1
  return a.created_at.localeCompare(b.created_at)
}

export default function TodayPage() {
  const now = today()
  const categories = useCategories()
  const habitData = useHabits()
  const tasks = useInboxTasks()
  const eventData = useLiveQuery(async () => {
    const events = (await db().events.where('status').equals('active').toArray()).filter((e) => !e.deleted_at)
    const subtasks = (await db().subtasks.toArray()).filter((s) => !s.deleted_at)
    const byEvent = new Map<string, Subtask[]>()
    for (const s of subtasks) byEvent.set(s.event_id, [...(byEvent.get(s.event_id) ?? []), s])
    return { events, byEvent }
  })

  useEffect(() => {
    void archiveExpired()
  }, [])

  if (!categories || !habitData || !tasks || !eventData) return <p className="text-sm text-slate-500">Lädt …</p>

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const colorOf = (categoryId: string | null) => (categoryId ? categoryById.get(categoryId)?.color : undefined) ?? NO_COLOR

  // Gewohnheiten: offene zuerst
  const habits = habitData.habits
    .map((habit) => {
      const checked = habitData.checkedBy.get(habit.id) ?? new Set<string>()
      return { habit, checked, state: habitState(habit, checked, now) }
    })
    .sort((a, b) => Number(a.state.satisfied) - Number(b.state.satisfied))
  const habitsDone = habits.filter((h) => h.state.satisfied).length

  // Aufgaben: fällig bis heute (inkl. überfällig) und heute erledigte
  const dueTasks = tasks
    .filter((t) => !t.done && t.due_date !== null && t.due_date <= now)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const openTasks = tasks.filter((t) => !t.done).length

  // Ereignisse mit messbarem Fortschritt als Ringe
  const withProgress = eventData.events
    .map((event) => ({ event, progress: eventProgress(event, eventData.byEvent.get(event.id) ?? []) }))
    .filter((x) => x.progress.ratio !== null)
    .sort((a, b) => byDueDate(a.event, b.event))

  // Nächste Termine
  const countdowns = eventData.events
    .filter((e) => e.progress_mode === 'countdown' && e.due_date !== null && e.due_date >= now)
    .sort(byDueDate)

  const dateLabel = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const nothingYet = habits.length === 0 && eventData.events.length === 0 && tasks.length === 0

  return (
    <div className="space-y-6">
      {/* Überblick */}
      <section className="card flex items-center gap-4">
        <Ring ratio={habits.length > 0 ? habitsDone / habits.length : 0} size={84} stroke={9}>
          <span className="text-base">
            {habitsDone}/{habits.length}
          </span>
        </Ring>
        <div className="min-w-0">
          <p className="text-sm text-slate-500 capitalize dark:text-slate-400">{dateLabel}</p>
          <p className="text-lg font-semibold">
            {habits.length === 0
              ? 'Willkommen bei Momentum'
              : habitsDone === habits.length
                ? 'Alle Gewohnheiten geschafft 🎉'
                : `Noch ${habits.length - habitsDone} ${habits.length - habitsDone === 1 ? 'Gewohnheit' : 'Gewohnheiten'} offen`}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {dueTasks.length > 0 ? `${dueTasks.length} fällig · ` : ''}
            {openTasks} {openTasks === 1 ? 'Aufgabe' : 'Aufgaben'} im Eingang
          </p>
        </div>
      </section>

      {nothingYet && (
        <div className="card py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Noch ist hier nichts los. Tippe auf das ➕ und leg deine erste Aufgabe, ein Ereignis oder eine Gewohnheit an.
        </div>
      )}

      {withProgress.length > 0 && (
        <Section
          title="Fortschritt"
          link={withProgress.length > MAX_RINGS ? { to: '/ereignisse', label: 'Alle anzeigen' } : undefined}
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {withProgress.slice(0, MAX_RINGS).map(({ event, progress }) => (
              <Link
                key={event.id}
                to={`/ereignisse/${event.id}`}
                className="card flex flex-col items-center gap-2 p-3 text-center transition-shadow hover:shadow-md"
              >
                <Ring ratio={progress.ratio!} color={colorOf(event.category_id)} />
                <span className="line-clamp-2 text-xs leading-tight font-medium">{event.title}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {habits.length > 0 && (
        <Section title="Gewohnheiten heute" link={{ to: '/gewohnheiten', label: 'Alle' }}>
          <div className="grid gap-2">
            {habits.map(({ habit, checked }) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                checked={checked}
                category={habit.category_id ? categoryById.get(habit.category_id) : undefined}
                compact
              />
            ))}
          </div>
        </Section>
      )}

      {dueTasks.length > 0 && (
        <Section title="Fällige Aufgaben" link={{ to: '/eingang', label: 'Eingang' }}>
          <ul className="card space-y-1">
            {dueTasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </Section>
      )}

      {countdowns.length > 0 && (
        <Section
          title="Nächste Termine"
          link={countdowns.length > MAX_COUNTDOWNS ? { to: '/ereignisse', label: 'Alle anzeigen' } : undefined}
        >
          <ul className="card divide-y divide-slate-200 py-1 dark:divide-slate-800">
            {countdowns.slice(0, MAX_COUNTDOWNS).map((e) => (
              <li key={e.id}>
                <Link to={`/ereignisse/${e.id}`} className="flex items-center gap-3 py-2.5">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(e.category_id) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{formatDate(e.due_date!)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{countdownLabel(e.due_date!)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
