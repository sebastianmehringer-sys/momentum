import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import EventForm from '../components/EventForm'
import Modal from '../components/Modal'
import ProgressBar from '../components/ProgressBar'
import { baseFields, deleteRow, saveRow, updateRow } from '../lib/data'
import { formatDate } from '../lib/dates'
import { db, type EventItem, type Subtask } from '../lib/db'
import { deleteEvent, refreshEventStatus, subtasksOf } from '../lib/events'
import { eventProgress, formatNumber, parseNumber } from '../lib/progress'

const TYPE_LABEL = { project: 'Vorhaben', appointment: 'Termin', savings: 'Sparziel' } as const

function Checklist({ event, subtasks }: { event: EventItem; subtasks: Subtask[] }) {
  const [title, setTitle] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const sort_order = Math.max(-1, ...subtasks.map((s) => s.sort_order)) + 1
    await saveRow('subtasks', {
      ...baseFields(),
      event_id: event.id,
      title: title.trim(),
      done: false,
      done_at: null,
      sort_order,
    })
    setTitle('')
    await refreshEventStatus(event.id)
  }

  async function toggle(s: Subtask) {
    await updateRow('subtasks', s.id, { done: !s.done, done_at: s.done ? null : new Date().toISOString() })
    await refreshEventStatus(event.id)
  }

  async function remove(s: Subtask) {
    await deleteRow('subtasks', s.id)
    await refreshEventStatus(event.id)
  }

  return (
    <section className="card">
      <h3 className="mb-3 font-semibold">Checkliste</h3>
      <ul className="space-y-1">
        {subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void toggle(s)}
              role="checkbox"
              aria-checked={s.done}
              aria-label={s.title}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                s.done ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {s.done && <Check className="h-4 w-4" />}
            </button>
            <span className={`min-w-0 flex-1 py-1.5 text-sm ${s.done ? 'text-slate-400 line-through' : ''}`}>
              {s.title}
            </span>
            <button
              type="button"
              className="btn btn-ghost px-2"
              onClick={() => void remove(s)}
              aria-label={`${s.title} löschen`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void add(e)} className="mt-3 flex gap-2">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neue Unteraufgabe"
          aria-label="Neue Unteraufgabe"
        />
        <button type="submit" className="btn btn-primary px-3" disabled={!title.trim()} aria-label="Hinzufügen">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </section>
  )
}

function NumericUpdate({ event }: { event: EventItem }) {
  const [amount, setAmount] = useState('')
  const parsed = parseNumber(amount) ?? 0
  const valid = parsed !== 0

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    await updateRow('events', event.id, { current_value: (event.current_value ?? 0) + parsed })
    setAmount('')
    await refreshEventStatus(event.id)
  }

  const missing = (event.target_value ?? 0) - (event.current_value ?? 0)

  return (
    <section className="card">
      <h3 className="mb-1 font-semibold">Stand aktualisieren</h3>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        {missing > 0
          ? `Es fehlen noch ${formatNumber(missing)}${event.unit ? ` ${event.unit}` : ''}.`
          : 'Ziel erreicht 🎉'}
      </p>
      <form onSubmit={(e) => void add(e)} className="flex gap-2">
        <input
          className="input"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Betrag${event.unit ? ` in ${event.unit}` : ''} (Minus zum Abziehen)`}
          aria-label="Betrag hinzufügen"
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={!valid}>
          <Plus className="h-4 w-4" /> Hinzufügen
        </button>
      </form>
    </section>
  )
}

export default function EventDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const data = useLiveQuery(async () => {
    const event = await db().events.get(id)
    if (!event || event.deleted_at) return { event: null }
    const category = event.category_id ? await db().categories.get(event.category_id) : undefined
    return { event, subtasks: await subtasksOf(id), category: category?.deleted_at ? undefined : category }
  }, [id])

  if (!data) return <p className="text-sm text-slate-500">Lädt …</p>

  const back = (
    <Link to="/ereignisse" className="btn btn-ghost -ml-2 px-2">
      <ArrowLeft className="h-4 w-4" /> Alle Ereignisse
    </Link>
  )

  if (!data.event) {
    return (
      <div className="space-y-4">
        {back}
        <div className="card py-10 text-center text-sm text-slate-500">Dieses Ereignis gibt es nicht mehr.</div>
      </div>
    )
  }

  const { event, subtasks, category } = data
  const progress = eventProgress(event, subtasks)
  const color = category?.color ?? '#64748b'
  const showChecklist = event.progress_mode === 'checklist' || event.progress_mode === 'countdown'

  return (
    <div className="space-y-4">
      {back}

      <section className="card border-l-4" style={{ borderLeftColor: color }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {TYPE_LABEL[event.type]}
              {category && ` · ${category.emoji} ${category.name}`}
              {event.status !== 'active' && ' · ✅ Erledigt'}
            </p>
            <h2 className="mt-1 text-xl font-bold break-words">{event.title}</h2>
          </div>
          <div className="flex shrink-0">
            <button type="button" className="btn btn-ghost px-2" onClick={() => setEditing(true)} aria-label="Bearbeiten">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2"
              onClick={() => setConfirmDelete(true)}
              aria-label="Löschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{progress.label}</p>
        {progress.ratio !== null && (
          <div className="mt-2">
            <ProgressBar ratio={progress.ratio} color={color} />
          </div>
        )}

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          {event.start_date && (
            <div>
              <dt className="inline">Start: </dt>
              <dd className="inline">{formatDate(event.start_date)}</dd>
            </div>
          )}
          {event.due_date && (
            <div>
              <dt className="inline">{event.progress_mode === 'countdown' ? 'Datum: ' : 'Ziel: '}</dt>
              <dd className="inline">{formatDate(event.due_date)}</dd>
            </div>
          )}
        </dl>
        {event.note && <p className="mt-3 text-sm whitespace-pre-wrap">{event.note}</p>}
      </section>

      {event.progress_mode === 'numeric' && <NumericUpdate event={event} />}
      {showChecklist && <Checklist event={event} subtasks={subtasks} />}
      {event.progress_mode === 'countdown' && subtasks.length === 0 && (
        <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
          Tipp: Mit einer Checkliste zeigt der Termin zusätzlich einen Fortschritt für die Vorbereitung.
        </p>
      )}

      {editing && <EventForm event={event} onClose={() => setEditing(false)} />}

      {confirmDelete && (
        <Modal title="Ereignis löschen?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            „{event.title}“ wird mit allen Unteraufgaben gelöscht.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void deleteEvent(event.id).then(() => navigate('/ereignisse'))
              }}
            >
              Löschen
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
