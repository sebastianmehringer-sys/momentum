import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { addInboxTask } from '../lib/inbox'
import { HabitForm } from '../pages/Habits'
import EventForm from './EventForm'
import Modal from './Modal'

type Mode = 'task' | 'event' | 'habit'

const MODES: { value: Mode; label: string }[] = [
  { value: 'task', label: '📥 Aufgabe' },
  { value: 'event', label: '🎯 Ereignis' },
  { value: 'habit', label: '🔁 Gewohnheit' },
]

function TaskForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addInboxTask(title, due || null)
    onClose()
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Was ist zu tun?"
        aria-label="Aufgabe"
        autoFocus
      />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Fällig am (optional)</span>
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
          In den Eingang
        </button>
      </div>
    </form>
  )
}

/** ➕-Knopf, der überall sichtbar ist. Standard: Aufgabe in den Eingang. */
export default function QuickAdd() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('task')

  function close() {
    setOpen(false)
    setMode('task')
  }

  const switcher = (
    <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => setMode(m.value)}
          aria-pressed={mode === m.value}
          className={`rounded-lg px-2 py-1.5 text-sm font-medium ${
            mode === m.value ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Schnell-Eingabe"
        title="Schnell-Eingabe"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:bg-indigo-700 active:scale-95 md:right-8 md:bottom-8"
      >
        <Plus className="h-7 w-7" />
      </button>

      {open && mode === 'task' && (
        <Modal title="Schnell-Eingabe" onClose={close}>
          {switcher}
          <TaskForm onClose={close} />
        </Modal>
      )}
      {open && mode === 'event' && <EventForm title="Schnell-Eingabe" header={switcher} onClose={close} />}
      {open && mode === 'habit' && <HabitForm title="Schnell-Eingabe" header={switcher} onClose={close} />}
    </>
  )
}
