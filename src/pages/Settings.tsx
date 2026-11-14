import { useLiveQuery } from 'dexie-react-hooks'
import { Check, LogOut, Monitor, Moon, Pencil, Plus, RefreshCw, Sun, Trash2, X } from 'lucide-react'
import { describeResult, syncCalendar } from '../lib/calendar'
import { useState, type FormEvent } from 'react'
import SyncIndicator, { syncLabel, useSyncStatus } from '../components/SyncIndicator'
import { useAuth } from '../lib/auth'
import { baseFields, deleteRow, saveRow, updateRow } from '../lib/data'
import { db, type Category, type Theme } from '../lib/db'
import { applyTheme, storedTheme } from '../lib/theme'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6', '#64748b']

function useCategories() {
  return useLiveQuery(async () => (await db().categories.orderBy('sort_order').toArray()).filter((c) => !c.deleted_at))
}

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------
function ThemeSection() {
  const saved = useLiveQuery(async () => (await db().settings.get(db().userId))?.theme)
  const [local, setLocal] = useState<Theme>(storedTheme())
  const theme = saved ?? local

  function choose(next: Theme) {
    setLocal(next)
    applyTheme(next)
    void updateRow('settings', db().userId, { theme: next })
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: 'Automatisch', icon: Monitor },
    { value: 'light', label: 'Hell', icon: Sun },
    { value: 'dark', label: 'Dunkel', icon: Moon },
  ]

  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Darstellung</h2>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={theme === value}
            className={`btn flex-col py-3 ${
              theme === value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------
function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { name: string; emoji: string; color: string }
  onSave: (v: { name: string; emoji: string; color: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [emoji, setEmoji] = useState(initial.emoji)
  const [color, setColor] = useState(initial.color)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), emoji: emoji.trim(), color })
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
      <div className="flex gap-2">
        <input
          className="input w-16 text-center"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🙂"
          aria-label="Emoji"
          maxLength={4}
        />
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name der Kategorie"
          aria-label="Name"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Farbe ${c}`}
            aria-pressed={color === c}
            className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-800' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X className="h-4 w-4" /> Abbrechen
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          <Check className="h-4 w-4" /> Speichern
        </button>
      </div>
    </form>
  )
}

/** Fragt vor dem Löschen, wohin die Einträge der Kategorie verschoben werden. */
function DeleteCategoryDialog({
  category,
  others,
  onClose,
}: {
  category: Category
  others: Category[]
  onClose: () => void
}) {
  const usage = useLiveQuery(async () => {
    const events = (await db().events.where('category_id').equals(category.id).toArray()).filter((e) => !e.deleted_at)
    const habits = (await db().habits.where('category_id').equals(category.id).toArray()).filter((h) => !h.deleted_at)
    return { events, habits }
  }, [category.id])
  const [target, setTarget] = useState<string>(others[0]?.id ?? '')

  if (!usage) return null
  const count = usage.events.length + usage.habits.length

  async function confirm() {
    const newCategory = target || null
    for (const e of usage!.events) await updateRow('events', e.id, { category_id: newCategory })
    for (const h of usage!.habits) await updateRow('habits', h.id, { category_id: newCategory })
    await deleteRow('categories', category.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-sm space-y-4">
        <h3 className="font-semibold">
          {category.emoji} {category.name} löschen?
        </h3>
        {count > 0 ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              In dieser Kategorie {count === 1 ? 'liegt 1 Eintrag' : `liegen ${count} Einträge`}. Wohin{' '}
              {count === 1 ? 'soll er' : 'sollen sie'} verschoben werden?
            </p>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
              <option value="">Ohne Kategorie</option>
            </select>
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Die Kategorie enthält keine Einträge.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void confirm()}>
            Löschen
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoriesSection() {
  const categories = useCategories()
  const [editing, setEditing] = useState<string | null>(null) // id oder 'new'
  const [deleting, setDeleting] = useState<Category | null>(null)

  async function add(v: { name: string; emoji: string; color: string }) {
    const sort_order = Math.max(-1, ...(categories ?? []).map((c) => c.sort_order)) + 1
    await saveRow('categories', { ...baseFields(), ...v, sort_order })
    setEditing(null)
  }

  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Kategorien</h2>
      {categories === undefined ? (
        <p className="text-sm text-slate-500">Lädt …</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) =>
            editing === c.id ? (
              <li key={c.id}>
                <CategoryForm
                  initial={c}
                  onCancel={() => setEditing(null)}
                  onSave={(v) => {
                    void updateRow('categories', c.id, v)
                    setEditing(null)
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg"
                  style={{ backgroundColor: `${c.color}33` }}
                >
                  {c.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <button
                  type="button"
                  className="btn btn-ghost px-2"
                  onClick={() => setEditing(c.id)}
                  aria-label={`${c.name} bearbeiten`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2"
                  onClick={() => setDeleting(c)}
                  aria-label={`${c.name} löschen`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ),
          )}
          {categories.length === 0 && editing !== 'new' && (
            <li className="text-sm text-slate-500">Noch keine Kategorien vorhanden.</li>
          )}
        </ul>
      )}

      <div className="mt-3">
        {editing === 'new' ? (
          <CategoryForm
            initial={{ name: '', emoji: '', color: COLORS[0] }}
            onCancel={() => setEditing(null)}
            onSave={(v) => void add(v)}
          />
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Kategorie hinzufügen
          </button>
        )}
      </div>

      {deleting && (
        <DeleteCategoryDialog
          category={deleting}
          others={(categories ?? []).filter((c) => c.id !== deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Kalender
// ---------------------------------------------------------------------------
function CalendarSection() {
  const settings = useLiveQuery(async () => (await db().settings.get(db().userId)) ?? null)
  const [url, setUrl] = useState('')
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (settings === undefined) return null
  const connected = Boolean(settings?.ical_url)

  async function run() {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ ok: true, text: describeResult(await syncCalendar()) })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const value = url.trim()
    if (!value.startsWith('https://calendar.google.com/')) {
      setMessage({ ok: false, text: 'Die Adresse muss mit https://calendar.google.com/ beginnen.' })
      return
    }
    await updateRow('settings', db().userId, { ical_url: value })
    setUrl('')
    setChanging(false)
    await run()
  }

  async function remove() {
    await updateRow('settings', db().userId, { ical_url: null })
    setMessage({ ok: true, text: 'Kalender getrennt. Bereits übernommene Termine bleiben erhalten.' })
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Kalender</h2>

      {connected && !changing ? (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            ✅ Kalender verbunden. Termine werden stündlich automatisch abgeglichen.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Jetzt abgleichen
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setChanging(true)} disabled={busy}>
              Adresse ändern
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void remove()} disabled={busy}>
              Trennen
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => void save(e)} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Füge hier die <strong>geheime Adresse im iCal-Format</strong> deines Google-Kalenders „Fortschritt“ ein. Du
            findest sie in Google Kalender unter Einstellungen → dein Kalender → „Kalender integrieren“.
          </p>
          <input
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            aria-label="Geheime iCal-Adresse"
            autoComplete="off"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy || !url.trim()}>
              Speichern &amp; abgleichen
            </button>
            {changing && (
              <button type="button" className="btn btn-ghost" onClick={() => setChanging(false)}>
                Abbrechen
              </button>
            )}
          </div>
        </form>
      )}

      {message && (
        <p className={`text-sm ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Konto + Sync
// ---------------------------------------------------------------------------
function AccountSection() {
  const { session, signOut } = useAuth()
  const status = useSyncStatus()

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Konto &amp; Synchronisierung</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Angemeldet als {session?.user.email}</p>
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <SyncIndicator />
        <div>
          <div>{syncLabel(status)}</div>
          {status.lastSync && (
            <div className="text-xs text-slate-500">
              Zuletzt:{' '}
              {new Date(status.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
          {status.error && <div className="text-xs text-red-600">{status.error}</div>}
        </div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
        <LogOut className="h-4 w-4" /> Abmelden
      </button>
    </section>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <ThemeSection />
      <CategoriesSection />
      <CalendarSection />
      <AccountSection />
    </div>
  )
}
