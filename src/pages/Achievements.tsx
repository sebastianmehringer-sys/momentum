import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { formatDate, formatDayMonth, today, weekStart } from '../lib/dates'
import { db, type ReviewData, type WeeklyReview } from '../lib/db'
import { habitState } from '../lib/streak'
import { supabase } from '../lib/supabase'
import { refreshReviews, syncAndWait } from '../lib/sync'
import { useHabits } from './Habits'

const percent = (ratio: number) => `${Math.round(ratio * 100)} %`

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function ReviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{title}</h4>
      {children}
    </div>
  )
}

function ReviewDetails({ data }: { data: ReviewData }) {
  // Termine ohne Checkliste haben keinen Fortschritt; sie stehen unter „Nächste Termine“
  const events = data.events.filter((e) => e.ratio !== null || e.completed)
  const nothing =
    data.tasks_done.count === 0 &&
    events.length === 0 &&
    data.habits.length === 0 &&
    data.leftover.count === 0 &&
    data.upcoming.length === 0

  return (
    <div className="mt-3 space-y-4 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
      {nothing && <p className="text-slate-500">In dieser Woche gab es noch nichts auszuwerten.</p>}

      {data.tasks_done.count > 0 && (
        <ReviewBlock title={`Erledigte Aufgaben (${data.tasks_done.count})`}>
          <ul className="list-inside list-disc text-slate-700 dark:text-slate-200">
            {data.tasks_done.titles.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
            {data.tasks_done.count > data.tasks_done.titles.length && (
              <li className="list-none text-slate-500">
                … und {data.tasks_done.count - data.tasks_done.titles.length} weitere
              </li>
            )}
          </ul>
        </ReviewBlock>
      )}

      {events.length > 0 && (
        <ReviewBlock title="Fortschritt der Ereignisse">
          <ul className="space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {e.completed && '✅ '}
                  {e.title}
                </span>
                <span className="shrink-0 tabular-nums">
                  {e.ratio === null ? '–' : percent(e.ratio)}
                  {e.delta !== null && Math.round(e.delta * 100) !== 0 && (
                    <span className={e.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}>
                      {' '}
                      ({e.delta > 0 ? '+' : '−'}
                      {Math.abs(Math.round(e.delta * 100))})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </ReviewBlock>
      )}

      {data.habits.length > 0 && (
        <ReviewBlock title="Gewohnheiten">
          <ul className="space-y-1">
            {data.habits.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {h.achieved ? '✅' : '❌'} {h.title}
                </span>
                <span className="shrink-0 text-slate-600 tabular-nums dark:text-slate-300">
                  {h.done}/{h.goal}
                  {h.streak > 0 &&
                    ` · 🔥 ${h.streak} ${h.frequency === 'daily' ? (h.streak === 1 ? 'Tag' : 'Tage') : h.streak === 1 ? 'Woche' : 'Wochen'}`}
                </span>
              </li>
            ))}
          </ul>
        </ReviewBlock>
      )}

      {data.leftover.count > 0 && (
        <ReviewBlock title={`Liegengeblieben (${data.leftover.count})`}>
          <ul className="list-inside list-disc text-slate-700 dark:text-slate-200">
            {data.leftover.titles.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </ReviewBlock>
      )}

      {data.upcoming.length > 0 && (
        <ReviewBlock title="Nächste Termine">
          <ul className="space-y-1">
            {data.upcoming.map((u, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{u.title}</span>
                <span className="shrink-0 text-slate-600 dark:text-slate-300">{formatDate(u.date)}</span>
              </li>
            ))}
          </ul>
        </ReviewBlock>
      )}
    </div>
  )
}

function ReviewCard({ review, initiallyOpen }: { review: WeeklyReview; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const { data } = review
  const habitsDone = data.habits.filter((h) => h.achieved).length

  return (
    <div className="card">
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            Woche {formatDayMonth(data.week_start)} – {formatDate(data.week_end)}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {data.tasks_done.count} {data.tasks_done.count === 1 ? 'Aufgabe' : 'Aufgaben'} erledigt
            {data.habits.length > 0 && ` · ${habitsDone}/${data.habits.length} Gewohnheiten geschafft`}
          </span>
        </span>
      </button>
      {open && <ReviewDetails data={data} />}
    </div>
  )
}

export default function AchievementsPage() {
  const now = today()
  const year = now.slice(0, 4)
  const habitData = useHabits()
  const data = useLiveQuery(async () => {
    const events = (await db().events.toArray()).filter((e) => !e.deleted_at)
    const subtasksDone = (await db().subtasks.toArray()).filter((s) => !s.deleted_at && s.done).length
    const tasksDone = (await db().inbox_tasks.toArray()).filter((t) => !t.deleted_at && t.done).length
    const reviews = await db().weekly_reviews.orderBy('week_start').reverse().toArray()
    const categories = await db().categories.toArray()
    return { events, tasksDone: subtasksDone + tasksDone, reviews, categories }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!data || !habitData) return <p className="text-sm text-slate-500">Lädt …</p>

  const archive = data.events
    .filter((e) => e.status !== 'active')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  const goalsThisYear = archive.filter((e) => e.type !== 'appointment' && (e.completed_at ?? '').startsWith(year)).length
  const categoryById = new Map(data.categories.map((c) => [c.id, c]))

  const records = habitData.habits.map((habit) => ({
    habit,
    state: habitState(habit, habitData.checkedBy.get(habit.id) ?? new Set<string>(), now),
  }))
  // Bester Tages-Streak; gibt es nur Wochen-Gewohnheiten, der beste Wochen-Streak
  const daily = records.filter((r) => r.habit.frequency === 'daily')
  const best = (daily.length > 0 ? daily : records).reduce<(typeof records)[number] | null>(
    (top, r) => (top === null || r.state.longest > top.state.longest ? r : top),
    null,
  )

  const hasCurrentReview = data.reviews.some((r) => r.week_start === weekStart(now))

  async function createReview() {
    setBusy(true)
    setError(null)
    try {
      if (!navigator.onLine) throw new Error('Dafür brauchst du eine Internetverbindung.')
      await syncAndWait() // erst alles hochladen, damit der Server den aktuellen Stand kennt
      const { error: fnError } = await supabase.functions.invoke('weekly-review', { body: {} })
      if (fnError) throw new Error('Der Rückblick konnte nicht erstellt werden.')
      await refreshReviews()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Statistik */}
      <section>
        <h2 className="mb-2 font-semibold">Statistik</h2>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={goalsThisYear} label={`Ziele erreicht ${year}`} />
          <Stat value={data.tasksDone} label="Aufgaben erledigt" />
          <Stat value={best && best.state.longest > 0 ? best.state.longestLabel : '–'} label="Längster Streak" />
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Streaks</h2>
          <ul className="card divide-y divide-slate-200 py-1 text-sm dark:divide-slate-800">
            {records.map(({ habit, state }) => (
              <li key={habit.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-medium">{habit.title}</span>
                <span className="shrink-0 text-right text-slate-600 dark:text-slate-300">
                  {state.streak > 0 ? '🔥 ' : ''}
                  {state.streakLabel}
                  <span className="text-slate-400"> · Rekord {state.longestLabel}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Wochenrückblicke */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Wochenrückblicke</h2>
          <button type="button" className="btn btn-ghost px-2 text-xs" onClick={() => void createReview()} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {hasCurrentReview ? 'Diese Woche aktualisieren' : 'Diese Woche jetzt erstellen'}
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {data.reviews.length === 0 ? (
          <div className="card py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Dein erster Rückblick wird am Sonntagabend um 19 Uhr automatisch erstellt.
          </div>
        ) : (
          <div className="grid gap-2">
            {data.reviews.map((r, i) => (
              <ReviewCard key={r.id} review={r} initiallyOpen={i === 0} />
            ))}
          </div>
        )}
      </section>

      {/* Archiv */}
      <section>
        <h2 className="mb-2 font-semibold">Archiv „Erledigt“ ({archive.length})</h2>
        {archive.length === 0 ? (
          <div className="card py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Hier landen erreichte Ziele, komplette Checklisten und vergangene Termine.
          </div>
        ) : (
          <ul className="card divide-y divide-slate-200 py-1 dark:divide-slate-800">
            {archive.map((e) => {
              const category = e.category_id ? categoryById.get(e.category_id) : undefined
              return (
                <li key={e.id}>
                  <Link to={`/ereignisse/${e.id}`} className="flex items-center gap-3 py-2.5">
                    <span
                      className="h-8 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category?.color ?? '#64748b' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {e.type === 'appointment' ? '📅' : e.type === 'savings' ? '💰' : '🎯'} {e.title}
                      </span>
                      {category && !category.deleted_at && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {category.emoji} {category.name}
                        </span>
                      )}
                    </span>
                    {e.completed_at && (
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(e.completed_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
