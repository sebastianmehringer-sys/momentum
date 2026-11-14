// Entscheidet, welche Push-Benachrichtigungen jetzt fällig sind und welche davon
// gesendet werden dürfen (höchstens 2 pro Tag, nach Wichtigkeit).
// Reine Logik ohne Datenbankzugriff, damit sie sich testen lässt.

import { addDays, berlinDate, dailyStreak, weekCount } from './core.ts'

export type NotificationKind = 'achievement' | 'countdown1' | 'evening' | 'countdown7' | 'weekly'

/** Reihenfolge bei zu vielen: Erfolg → Countdown 1 Tag → Abend-Check → Countdown 7 Tage → Wochenrückblick */
export const PRIORITY: Record<NotificationKind, number> = {
  achievement: 1,
  countdown1: 2,
  evening: 3,
  countdown7: 4,
  weekly: 5,
}

export const MAX_PER_DAY = 2
export const COUNTDOWN_HOUR = 9
export const WEEKLY_HOUR = 19
export const EVENING_HOUR = 20
export const STREAK_MILESTONES = [7, 30, 100]

export interface Candidate {
  kind: NotificationKind
  /** Eindeutig pro Anlass, damit nichts doppelt gesendet wird */
  ref: string
  title: string
  body: string
  /** Seite, die beim Antippen geöffnet wird */
  url: string
}

export interface NotifySettings {
  notify_evening: boolean
  notify_countdown: boolean
  notify_achievement: boolean
  notify_weekly: boolean
}

export interface NotifyInput {
  settings: NotifySettings
  events: {
    id: string
    title: string
    type: string
    progress_mode: string
    due_date: string | null
    status: string
    completed_at: string | null
    deleted_at: string | null
  }[]
  subtasks: { event_id: string; done: boolean; deleted_at: string | null }[]
  habits: {
    id: string
    title: string
    frequency: 'daily' | 'weekly'
    times_per_week: number | null
    active: boolean
    deleted_at: string | null
  }[]
  habit_checks: { habit_id: string; date: string; deleted_at: string | null }[]
  /** Gibt es für die laufende Woche schon einen Rückblick? */
  hasReviewThisWeek: boolean
}

export interface Clock {
  /** Aktueller Zeitpunkt */
  now: Date
  /** Berliner Datum JJJJ-MM-TT */
  today: string
  /** Berliner Stunde 0–23 */
  hour: number
  isSunday: boolean
  /** Montag der laufenden Woche */
  monday: string
}

function activeHabits(input: NotifyInput) {
  return input.habits.filter((h) => !h.deleted_at && h.active)
}

function checkedByHabit(input: NotifyInput): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const c of input.habit_checks) {
    if (c.deleted_at) continue
    if (!map.has(c.habit_id)) map.set(c.habit_id, new Set())
    map.get(c.habit_id)!.add(c.date)
  }
  return map
}

function join(titles: string[]): string {
  return titles.length <= 2 ? titles.join(' und ') : `${titles.slice(0, 2).join(', ')} und ${titles.length - 2} weitere`
}

function countdownCandidate(input: NotifyInput, clock: Clock, days: 1 | 7): Candidate | null {
  const date = addDays(clock.today, days)
  const due = input.events.filter(
    (e) => !e.deleted_at && e.status === 'active' && e.progress_mode === 'countdown' && e.due_date === date,
  )
  if (due.length === 0) return null

  const labels = due.map((e) => {
    const subtasks = input.subtasks.filter((s) => !s.deleted_at && s.event_id === e.id)
    // Mit Checklisten-Stand, falls vorhanden
    return subtasks.length > 0 ? `${e.title} (${subtasks.filter((s) => s.done).length}/${subtasks.length} erledigt)` : e.title
  })
  return {
    kind: days === 1 ? 'countdown1' : 'countdown7',
    ref: date,
    title: days === 1 ? 'Morgen ist es so weit' : 'Noch 7 Tage',
    body: join(labels),
    url: due.length === 1 ? `/ereignisse/${due[0].id}` : '/ereignisse',
  }
}

/** Alle Benachrichtigungen, deren Zeitpunkt jetzt gekommen ist (noch ohne Tageslimit). */
export function buildCandidates(input: NotifyInput, clock: Clock): Candidate[] {
  const out: Candidate[] = []
  const { settings } = input
  const checked = checkedByHabit(input)

  // --- Erfolg: sofort ------------------------------------------------------
  if (settings.notify_achievement) {
    const dayAgo = clock.now.getTime() - 24 * 3_600_000
    for (const e of input.events) {
      if (e.deleted_at || e.status !== 'done' || e.type === 'appointment' || !e.completed_at) continue
      if (Date.parse(e.completed_at) < dayAgo) continue
      out.push({
        kind: 'achievement',
        ref: `event:${e.id}`,
        title: 'Ziel erreicht 🎉',
        body: e.title,
        url: '/erfolge',
      })
    }
    for (const h of activeHabits(input)) {
      if (h.frequency !== 'daily') continue
      const days = checked.get(h.id) ?? new Set<string>()
      if (!days.has(clock.today)) continue
      const streak = dailyStreak(days, clock.today)
      if (!STREAK_MILESTONES.includes(streak)) continue
      out.push({
        kind: 'achievement',
        ref: `streak:${h.id}:${streak}:${clock.today}`,
        title: `${streak} Tage am Stück 🔥`,
        body: `${h.title}: Streak-Meilenstein erreicht!`,
        url: '/gewohnheiten',
      })
    }
  }

  // --- Countdown: 7 Tage und 1 Tag vorher, morgens -------------------------
  if (settings.notify_countdown && clock.hour === COUNTDOWN_HOUR) {
    for (const days of [1, 7] as const) {
      const c = countdownCandidate(input, clock, days)
      if (c) out.push(c)
    }
  }

  // --- Abend-Check: nur wenn Gewohnheiten offen sind ------------------------
  if (settings.notify_evening && clock.hour === EVENING_HOUR) {
    let open = 0
    let bestStreak = 0
    for (const h of activeHabits(input)) {
      const days = checked.get(h.id) ?? new Set<string>()
      if (days.has(clock.today)) continue
      if (h.frequency === 'weekly') {
        if (weekCount(days, clock.today) < (h.times_per_week ?? 1)) open++
      } else {
        open++
        bestStreak = Math.max(bestStreak, dailyStreak(days, clock.today))
      }
    }
    if (open > 0) {
      const streak = bestStreak > 0 ? ` – Streak: ${bestStreak} ${bestStreak === 1 ? 'Tag' : 'Tage'} 🔥` : ''
      out.push({
        kind: 'evening',
        ref: clock.today,
        title: 'Abend-Check',
        body: `Noch ${open} ${open === 1 ? 'Gewohnheit' : 'Gewohnheiten'} offen${streak}`,
        url: '/',
      })
    }
  }

  // --- Wochenrückblick: Sonntagabend ---------------------------------------
  if (settings.notify_weekly && clock.isSunday && clock.hour === WEEKLY_HOUR && input.hasReviewThisWeek) {
    out.push({
      kind: 'weekly',
      ref: clock.monday,
      title: 'Dein Rückblick ist fertig',
      body: 'Schau dir an, was du diese Woche geschafft hast.',
      url: '/erfolge',
    })
  }

  return out
}

/**
 * Wählt aus, was wirklich gesendet wird:
 *  - nichts doppelt (alreadySent enthält "art|ref" aller früheren Benachrichtigungen)
 *  - höchstens MAX_PER_DAY pro Tag, das Wichtigste zuerst
 *  - für den wichtigeren Abend-Check wird ein Platz freigehalten, solange er heute noch kommen kann
 */
export function selectToSend(
  candidates: Candidate[],
  alreadySent: Set<string>,
  sentToday: number,
  input: NotifyInput,
  clock: Clock,
): Candidate[] {
  const eveningStillPossible =
    input.settings.notify_evening && clock.hour < EVENING_HOUR && activeHabits(input).length > 0

  const chosen: Candidate[] = []
  let sent = sentToday
  const sorted = [...candidates].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])

  for (const c of sorted) {
    if (alreadySent.has(`${c.kind}|${c.ref}`)) continue
    const reserve = PRIORITY[c.kind] > PRIORITY.evening && eveningStillPossible ? 1 : 0
    if (sent + reserve >= MAX_PER_DAY) continue
    chosen.push(c)
    sent++
  }
  return chosen
}

export function makeClock(now: Date, hourOf: (d: Date) => number, mondayOf: (day: string) => string): Clock {
  const today = berlinDate(now)
  const monday = mondayOf(today)
  return { now, today, hour: hourOf(now), monday, isSunday: addDays(monday, 6) === today }
}
