import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, ChevronRight, CornerDownRight, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Modal from '../components/Modal'
import { deleteRow, updateRow } from '../lib/data'
import { countdownLabel, formatDate, today } from '../lib/dates'
import { db, type InboxTask } from '../lib/db'
import { addInboxTask, assignableEvents, assignTaskToEvent, toggleInboxTask } from '../lib/inbox'

/** Offene Aufgaben: zuerst nach Fälligkeit, dann nach Anlagezeit */
function byDue(a: InboxTask, b: InboxTask) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date && !b.due_date) return -1
  if (!a.due_date && b.due_date) return 1
  return a.created_at.localeCompare(b.created_at)
}

export function useInboxTasks() {
  return useLiveQuery(async () => (await db().inbox_tasks.toArray()).filter((t) => !t.deleted_at))
}

function AssignDialog({ task, onClose }: { task: InboxTask; onClose: () => void }) {
  const events = useLiveQuery(assignableEvents)
  const [eventId, setEventId] = useState('')
  const selected = eventId || events?.[0]?.id || ''

  return (
    <Modal title="Einem Ereignis zuordnen" onClose={onClose}>
      {events === undefined ? null : events.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Es gibt noch kein Vorhaben mit Checkliste und keinen Termin. Leg zuerst eines unter „Ereignisse“ an.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            „{task.title}“ wird Unteraufgabe in der Checkliste von:
          </p>
          <select className="input" value={selected} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.type === 'appointment' ? '📅' : '🎯'} {e.title}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void assignTaskToEvent(task, selected).then(onClose)
              }}
            >
              Zuordnen
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function EditDialog({ task, onClose }: { task: InboxTask; onClose: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [due, setDue] = useState(task.due_date ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await updateRow('inbox_tasks', task.id, { title: title.trim(), due_date: due || null })
    onClose()
  }

  return (
    <Modal title="Aufgabe bearbeiten" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titel" autoFocus />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Fällig am (optional)</span>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function TaskRow({
  task,
  onEdit,
  onAssign,
}: {
  task: InboxTask
  onEdit?: () => void
  onAssign?: () => void
}) {
  const overdue = !task.done && task.due_date !== null && task.due_date < today()

  return (
    <li className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void toggleInboxTask(task)}
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.title} abhaken`}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
          task.done ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {task.done && <Check className="h-4 w-4" />}
      </button>
      <button type="button" className="min-w-0 flex-1 py-1.5 text-left" onClick={onEdit} disabled={!onEdit}>
        <span className={`block truncate text-sm ${task.done ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
        {task.due_date && !task.done && (
          <span className={`block text-xs ${overdue ? 'font-medium text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
            {overdue ? 'überfällig · ' : ''}
            {countdownLabel(task.due_date)} ({formatDate(task.due_date)})
          </span>
        )}
      </button>
      {onAssign && (
        <button
          type="button"
          className="btn btn-ghost px-2"
          onClick={onAssign}
          aria-label={`${task.title} einem Ereignis zuordnen`}
          title="Einem Ereignis zuordnen"
        >
          <CornerDownRight className="h-4 w-4" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          className="btn btn-ghost px-2"
          onClick={() => void deleteRow('inbox_tasks', task.id)}
          aria-label={`${task.title} löschen`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

export default function InboxPage() {
  const tasks = useInboxTasks()
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState<InboxTask | null>(null)
  const [assigning, setAssigning] = useState<InboxTask | null>(null)
  const [showDone, setShowDone] = useState(false)

  if (!tasks) return <p className="text-sm text-slate-500">Lädt …</p>

  const open = tasks.filter((t) => !t.done).sort(byDue)
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addInboxTask(title, null)
    setTitle('')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void add(e)} className="flex gap-2">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neue Aufgabe"
          aria-label="Neue Aufgabe"
        />
        <button type="submit" className="btn btn-primary px-3" disabled={!title.trim()} aria-label="Aufgabe hinzufügen">
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {open.length === 0 ? (
        <div className="card py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {tasks.length === 0 ? 'Der Eingang ist leer. Über das ➕ kannst du jederzeit eine Aufgabe notieren.' : 'Alles erledigt 🎉'}
        </div>
      ) : (
        <ul className="card space-y-1">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} onAssign={() => setAssigning(t)} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div>
          <button type="button" className="btn btn-ghost px-2" onClick={() => setShowDone(!showDone)}>
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Erledigt ({done.length})
          </button>
          {showDone && (
            <ul className="card mt-2 space-y-1">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={() => setEditing(t)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {editing && <EditDialog task={editing} onClose={() => setEditing(null)} />}
      {assigning && <AssignDialog task={assigning} onClose={() => setAssigning(null)} />}
    </div>
  )
}
