// Liest eine iCal-Datei (Google Kalender) und plant den Abgleich mit der Datenbank.
// Reine Logik ohne Netz- oder Datenbankzugriff, damit sie sich testen lässt.

export interface ParsedEvent {
  uid: string
  title: string
  /** JJJJ-MM-TT; bei Serienterminen das nächste Vorkommen ab heute */
  date: string
}

interface RawEvent {
  uid: string
  title: string
  date: string
  rrule: string | null
  cancelled: boolean
  isOverride: boolean
}

/** Datum eines Zeitpunkts in Berliner Zeit (berücksichtigt Sommer-/Winterzeit) */
export function berlinDate(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d)
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim()
}

/** DTSTART-Wert in ein Datum umwandeln */
function toDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (z) {
    // Zeitpunkt in Weltzeit -> auf welchen Berliner Tag fällt er?
    return berlinDate(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)))
  }
  // Ganztägig oder mit eigener Zeitzone: der Kalendertag gilt
  return `${y}-${mo}-${d}`
}

function addDays(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function addMonths(s: string, n: number): string | null {
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + n, d))
  // 31. gibt es nicht in jedem Monat: solche Monate werden übersprungen
  return date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null
}

/**
 * Nächstes Vorkommen eines Serientermins ab heute (einfache Regeln:
 * täglich, wöchentlich, monatlich, jährlich, mit Abstand, Enddatum oder Anzahl).
 * Liegt alles in der Vergangenheit, kommt das letzte Vorkommen zurück.
 */
export function nextOccurrence(start: string, rrule: string, today: string): string {
  const rule = Object.fromEntries(rrule.split(';').map((p) => p.split('=') as [string, string]))
  const interval = Math.max(1, Number(rule.INTERVAL ?? 1))
  const until = rule.UNTIL ? toDate(rule.UNTIL) : null
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity

  const step = (n: number): string | null => {
    switch (rule.FREQ) {
      case 'DAILY':
        return addDays(start, n * interval)
      case 'WEEKLY':
        return addDays(start, n * interval * 7)
      case 'MONTHLY':
        return addMonths(start, n * interval)
      case 'YEARLY':
        return addMonths(start, n * interval * 12)
      default:
        return null
    }
  }

  let last = start
  let occurrences = 1
  for (let n = 1; n < 5000 && last < today && occurrences < count; n++) {
    const next = step(n)
    if (rule.FREQ !== 'MONTHLY' && rule.FREQ !== 'YEARLY' && next === null) break
    if (next === null) continue
    if (until && next > until) break
    last = next
    occurrences++
  }
  return last
}

/** Alle Termine der iCal-Datei, ohne abgesagte. */
export function parseIcal(text: string, today: string): ParsedEvent[] {
  // Lange Zeilen sind im iCal-Format umgebrochen (Fortsetzung beginnt mit Leerzeichen)
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)

  const raw: RawEvent[] = []
  let current: Partial<RawEvent> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { rrule: null, cancelled: false, isOverride: false }
      continue
    }
    if (line === 'END:VEVENT') {
      if (current?.uid && current.date) {
        raw.push({ title: '(Ohne Titel)', ...current } as RawEvent)
      }
      current = null
      continue
    }
    if (!current) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const name = line.slice(0, colon).split(';')[0].toUpperCase()
    const value = line.slice(colon + 1)

    switch (name) {
      case 'UID':
        current.uid = value.trim()
        break
      case 'SUMMARY':
        current.title = unescapeText(value) || '(Ohne Titel)'
        break
      case 'DTSTART':
        current.date = toDate(value) ?? undefined
        break
      case 'RRULE':
        current.rrule = value.trim()
        break
      case 'STATUS':
        current.cancelled = value.trim().toUpperCase() === 'CANCELLED'
        break
      case 'RECURRENCE-ID':
        current.isOverride = true
        break
    }
  }

  const byUid = new Map<string, ParsedEvent>()
  for (const e of raw) {
    // Einzelne geänderte Vorkommen einer Serie werden nicht gesondert behandelt
    if (e.isOverride || e.cancelled) continue
    byUid.set(e.uid, {
      uid: e.uid,
      title: e.title,
      date: e.rrule ? nextOccurrence(e.date, e.rrule, today) : e.date,
    })
  }
  return [...byUid.values()]
}

// ---------------------------------------------------------------------------
// Abgleich planen
// ---------------------------------------------------------------------------
export interface ExistingEvent {
  id: string
  calendar_uid: string
  title: string
  due_date: string | null
  status: 'active' | 'done' | 'archived'
  deleted_at: string | null
}

export interface SyncPlan {
  /** Neue Termine aus dem Kalender */
  insert: ParsedEvent[]
  /** Titel, Datum oder Status haben sich geändert (die eigene Checkliste bleibt unberührt) */
  update: { id: string; title: string; due_date: string; status: 'active' | 'done' }[]
  /** Im Kalender gelöscht und noch nicht vorbei: verschwindet aus der App */
  remove: string[]
  /** Im Kalender gelöscht, aber schon vorbei: bleibt im Archiv */
  archive: string[]
}

export function planSync(existing: ExistingEvent[], parsed: ParsedEvent[], today: string): SyncPlan {
  const plan: SyncPlan = { insert: [], update: [], remove: [], archive: [] }
  const existingByUid = new Map(existing.map((e) => [e.calendar_uid, e]))
  const parsedUids = new Set(parsed.map((p) => p.uid))

  for (const p of parsed) {
    const current = existingByUid.get(p.uid)
    if (!current) {
      // Längst vergangene Termine werden beim ersten Import nicht nachträglich angelegt
      if (p.date >= today) plan.insert.push(p)
      continue
    }
    // In der App gelöscht: bleibt gelöscht
    if (current.deleted_at) continue

    const status = p.date < today ? 'done' : 'active'
    if (current.title !== p.title || current.due_date !== p.date || current.status !== status) {
      plan.update.push({ id: current.id, title: p.title, due_date: p.date, status })
    }
  }

  for (const e of existing) {
    if (e.deleted_at || parsedUids.has(e.calendar_uid)) continue
    if (e.due_date !== null && e.due_date < today) {
      if (e.status === 'active') plan.archive.push(e.id)
    } else {
      plan.remove.push(e.id)
    }
  }

  return plan
}
