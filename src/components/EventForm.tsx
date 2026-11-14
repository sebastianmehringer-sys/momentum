import { useState, type FormEvent, type ReactNode } from 'react'
import { baseFields, saveRow } from '../lib/data'
import { parseNumber } from '../lib/progress'
import { today } from '../lib/dates'
import type { EventItem, EventType, ProgressMode } from '../lib/db'
import { refreshEventStatus } from '../lib/events'
import { useCategories } from '../lib/hooks'
import Modal from './Modal'

const TYPES: { value: EventType; label: string }[] = [
  { value: 'project', label: '🎯 Vorhaben' },
  { value: 'appointment', label: '📅 Termin' },
  { value: 'savings', label: '💰 Sparziel' },
]

const MODES: { value: ProgressMode; label: string; hint: string }[] = [
  { value: 'checklist', label: 'Checkliste', hint: 'Erledigte Unteraufgaben zählen, z. B. 3 von 5.' },
  { value: 'numeric', label: 'Zahlenwert', hint: 'Aktueller Stand von einem Ziel, z. B. 12 von 50 km.' },
  { value: 'time', label: 'Zeit', hint: 'Fortschritt läuft automatisch vom Start- bis zum Enddatum.' },
]

function toInput(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',')
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{text}</span>
      {children}
    </label>
  )
}

export default function EventForm({
  event,
  onClose,
  onSaved,
  title: modalTitle,
  header,
}: {
  event?: EventItem
  onClose: () => void
  onSaved?: (id: string) => void
  /** Eigener Fenstertitel und Inhalt über dem Formular (für die Schnell-Eingabe) */
  title?: string
  header?: ReactNode
}) {
  const categories = useCategories()
  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<EventType>(event?.type ?? 'project')
  const [mode, setMode] = useState<ProgressMode>(event?.progress_mode ?? 'checklist')
  const [categoryId, setCategoryId] = useState(event?.category_id ?? '')
  const [startDate, setStartDate] = useState(event?.start_date ?? today())
  const [dueDate, setDueDate] = useState(event?.due_date ?? '')
  const [current, setCurrent] = useState(toInput(event?.current_value ?? null))
  const [target, setTarget] = useState(toInput(event?.target_value ?? null))
  const [unit, setUnit] = useState(event?.unit ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  // Die Art legt fest, welche Fortschrittsarten möglich sind
  const effectiveMode: ProgressMode = type === 'appointment' ? 'countdown' : type === 'savings' ? 'numeric' : mode

  function chooseType(next: EventType) {
    setType(next)
    if (next === 'savings' && !unit) setUnit('€')
    if (next === 'project' && mode === 'countdown') setMode('checklist')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const targetValue = parseNumber(target)
    const currentValue = parseNumber(current) ?? 0

    if (!title.trim()) return setError('Bitte gib einen Namen ein.')
    if (effectiveMode === 'countdown' && !dueDate) return setError('Ein Termin braucht ein Datum.')
    if (effectiveMode === 'numeric' && (targetValue === null || targetValue <= 0))
      return setError('Bitte gib einen Zielwert größer als 0 ein.')
    if (effectiveMode === 'time') {
      if (!startDate || !dueDate) return setError('Bitte gib Start- und Enddatum ein.')
      if (dueDate <= startDate) return setError('Das Enddatum muss nach dem Startdatum liegen.')
    }

    const numeric = effectiveMode === 'numeric'
    const row: EventItem = {
      ...(event ?? {
        ...baseFields(),
        source: 'manual' as const,
        calendar_uid: null,
        status: 'active' as const,
        completed_at: null,
      }),
      title: title.trim(),
      type,
      progress_mode: effectiveMode,
      category_id: categoryId || null,
      start_date: effectiveMode === 'time' ? startDate : null,
      due_date: dueDate || null,
      current_value: numeric ? currentValue : null,
      target_value: numeric ? targetValue : null,
      unit: numeric ? unit.trim() || null : null,
      note: note.trim() || null,
    }
    await saveRow('events', row)
    await refreshEventStatus(row.id)
    onSaved?.(row.id)
    onClose()
  }

  const fromCalendar = event?.source === 'calendar'

  return (
    <Modal title={modalTitle ?? (event ? 'Ereignis bearbeiten' : 'Neues Ereignis')} onClose={onClose}>
      {header}
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <Label text="Name">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Führerschein"
            autoFocus
            disabled={fromCalendar}
          />
        </Label>

        {!fromCalendar && (
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Art</span>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => chooseType(t.value)}
                  aria-pressed={type === t.value}
                  className={`btn px-2 ${
                    type === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Label text="Kategorie">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Ohne Kategorie</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </Label>

        {type === 'project' && (
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Fortschritt messen über
            </span>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  aria-pressed={effectiveMode === m.value}
                  className={`btn px-2 ${
                    effectiveMode === m.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {MODES.find((m) => m.value === effectiveMode)?.hint}
            </p>
          </div>
        )}

        {effectiveMode === 'numeric' && (
          <div className="grid grid-cols-3 gap-2">
            <Label text="Aktuell">
              <input className="input" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
            </Label>
            <Label text="Ziel">
              <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2000" />
            </Label>
            <Label text="Einheit">
              <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="€" />
            </Label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {effectiveMode === 'time' && (
            <Label text="Start">
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Label>
          )}
          {!fromCalendar && (
            <Label
              text={effectiveMode === 'time' ? 'Ende' : effectiveMode === 'countdown' ? 'Datum' : 'Zieldatum (optional)'}
            >
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Label>
          )}
        </div>

        <Label text="Notiz (optional)">
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  )
}
