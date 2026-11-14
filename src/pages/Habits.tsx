import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Modal from '../components/Modal'
import { baseFields, saveRow } from '../lib/data'
import { addDays, today, weekStart } from '../lib/dates'
import { db, type Category, type Habit } from '../lib/db'
import { deleteHabit, toggleHabitCheck } from '../lib/habits'
import { useCategories } from '../lib/hooks'
import { habitState } from '../lib/streak'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const NO_COLOR = '#6366f1'

// ---------------------------------------------------------------------------
// Formular
// ---------------------------------------------------------------------------
export function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const categories = useCategories()
  const [title, setTitle] = useState(habit?.title ?? '')
  const [categoryId, setCategoryId] = useState(habit?.category_id ?? '')
  const [frequency, setFrequency] = useState<Habit['frequency']>(habit?.frequency ?? 'daily')
  const [times, setTimes] = useState(habit?.times_per_week ?? 3)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await saveRow('habits', {
      ...(habit ?? { ...baseFields(), active: true }),
      title: title.trim(),
      category_id: categoryId || null,
      frequency,
      times_per_week: frequency === 'weekly' ? times : null,
    })
    onClose()
  }

  const choice = (value: Habit['frequency'], label: string) => (
    <button
      type="button"
      onClick={() => setFrequency(value)}
      aria-pressed={frequency === value}
      className={`btn ${
        frequency === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Modal title={habit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Name</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Gym"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Kategorie</span>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Ohne Kategorie</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Häufigkeit</span>
          <div className="grid grid-cols-2 gap-2">
            {choice('daily', 'Täglich')}
            {choice('weekly', 'X-mal pro Woche')}
          </div>
        </div>

        {frequency === 'weekly' && (
          <div className="flex items-center justify-between rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="text-sm">
              <strong>{times}-mal</strong> pro Woche (Tage egal)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost px-2"
                onClick={() => setTimes(Math.max(1, times - 1))}
                aria-label="Weniger"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost px-2"
                onClick={() => setTimes(Math.min(7, times + 1))}
                aria-label="Mehr"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {habit && confirmDelete ? (
          <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/40">
            <p className="text-sm">Gewohnheit mit allen Häkchen und dem Streak löschen?</p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  void deleteHabit(habit.id).then(onClose)
                }}
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {habit ? (
              <button type="button" className="btn btn-ghost text-red-600" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Löschen
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
                Speichern
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------
export function HabitCard({
  habit,
  checked,
  category,
  onEdit,
  compact = false,
}: {
  habit: Habit
  checked: Set<string>
  category?: Category
  onEdit?: () => void
  compact?: boolean
}) {
  const now = today()
  const state = habitState(habit, checked, now)
  const color = category?.color ?? NO_COLOR
  const monday = weekStart(now)

  const subtitle =
    habit.frequency === 'daily'
      ? 'Täglich'
      : `${state.thisWeek} von ${state.weeklyGoal} diese Woche${state.thisWeek >= state.weeklyGoal ? ' ✓' : ''}`

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleHabitCheck(habit.id, now)}
          role="checkbox"
          aria-checked={state.doneToday}
          aria-label={`${habit.title} heute abhaken`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-colors"
          style={state.doneToday ? { backgroundColor: color, borderColor: color, color: '#fff' } : { borderColor: color }}
        >
          {state.doneToday && <Check className="h-6 w-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{habit.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
            {category && ` · ${category.emoji} ${category.name}`}
          </p>
        </div>
        <div className="shrink-0 text-right" title="Streak">
          <div className={`text-sm font-semibold ${state.streak > 0 ? '' : 'text-slate-400'}`}>
            {state.streak > 0 ? '🔥' : '·'} {state.streakLabel}
          </div>
        </div>
        {onEdit && (
          <button type="button" className="btn btn-ghost px-2" onClick={onEdit} aria-label={`${habit.title} bearbeiten`}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label, i) => {
            const day = addDays(monday, i)
            const isChecked = checked.has(day)
            const future = day > now
            return (
              <button
                key={day}
                type="button"
                disabled={future}
                onClick={() => void toggleHabitCheck(habit.id, day)}
                aria-pressed={isChecked}
                aria-label={`${habit.title} ${label}`}
                className={`rounded-lg py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                  isChecked ? 'text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                } ${day === now ? 'ring-2 ring-slate-400/60' : ''}`}
                style={isChecked ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Alle Gewohnheiten mit ihren abgehakten Tagen. undefined, solange geladen wird. */
export function useHabits() {
  return useLiveQuery(async () => {
    const habits = (await db().habits.toArray())
      .filter((h) => !h.deleted_at && h.active)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const checks = (await db().habit_checks.toArray()).filter((c) => !c.deleted_at)
    const checkedBy = new Map<string, Set<string>>()
    for (const c of checks) {
      if (!checkedBy.has(c.habit_id)) checkedBy.set(c.habit_id, new Set())
      checkedBy.get(c.habit_id)!.add(c.date)
    }
    return { habits, checkedBy }
  })
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------
export default function HabitsPage() {
  const categories = useCategories()
  const data = useHabits()
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)

  if (!data || !categories) return <p className="text-sm text-slate-500">Lädt …</p>
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="space-y-4">
      <button type="button" className="btn btn-primary w-full md:w-auto" onClick={() => setEditing('new')}>
        <Plus className="h-4 w-4" /> Neue Gewohnheit
      </button>

      {data.habits.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Noch keine Gewohnheiten. Leg deine erste an, z. B. „Gym, 3-mal pro Woche“.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              checked={data.checkedBy.get(h.id) ?? new Set()}
              category={h.category_id ? categoryById.get(h.category_id) : undefined}
              onEdit={() => setEditing(h)}
            />
          ))}
        </div>
      )}

      {editing && <HabitForm habit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
