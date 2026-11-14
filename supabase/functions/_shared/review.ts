// Erstellt den Inhalt eines Wochenrückblicks aus den Rohdaten eines Nutzers.
// Reine Logik ohne Datenbankzugriff, damit sie sich testen lässt.

import { addDays, berlinDate, dailyStreak, daysBetween, progressRatio, weekCount, weeklyStreak } from './core.ts'

export interface ReviewData {
  week_start: string
  week_end: string
  tasks_done: { count: number; titles: string[] }
  events: {
    id: string
    title: string
    /** Fortschritt 0–1 am Ende der Woche, null bei Terminen ohne Checkliste */
    ratio: number | null
    /** Veränderung gegenüber der Vorwoche, null wenn es keinen Vergleich gibt */
    delta: number | null
    completed: boolean
  }[]
  habits: {
    id: string
    title: string
    frequency: 'daily' | 'weekly'
    done: number
    goal: number
    achieved: boolean
    streak: number
  }[]
  leftover: { count: number; titles: string[] }
  upcoming: { title: string; date: string }[]
}

export interface ReviewInput {
  events: {
    id: string
    title: string
    progress_mode: string
    start_date: string | null
    due_date: string | null
    current_value: number | null
    target_value: number | null
    status: string
    completed_at: string | null
    deleted_at: string | null
  }[]
  subtasks: { event_id: string; title: string; done: boolean; done_at: string | null; deleted_at: string | null }[]
  habits: {
    id: string
    title: string
    frequency: 'daily' | 'weekly'
    times_per_week: number | null
    active: boolean
    created_at: string
    deleted_at: string | null
  }[]
  habit_checks: { habit_id: string; date: string; deleted_at: string | null }[]
  inbox_tasks: {
    title: string
    due_date: string | null
    done: boolean
    done_at: string | null
    created_at: string
    deleted_at: string | null
  }[]
  /** Rückblick der Vorwoche, falls vorhanden (für den Vergleich) */
  previous: ReviewData | null
}

const MAX_TITLES = 20

/** weekStart = Montag der Woche, für die der Rückblick erstellt wird */
export function buildReview(input: ReviewInput, weekStart: string): ReviewData {
  const weekEnd = addDays(weekStart, 6)
  const inWeek = (timestamp: string | null) => {
    if (!timestamp) return false
    const day = berlinDate(new Date(timestamp))
    return day >= weekStart && day <= weekEnd
  }

  const subtasks = input.subtasks.filter((s) => !s.deleted_at)
  const tasks = input.inbox_tasks.filter((t) => !t.deleted_at)
  const events = input.events.filter((e) => !e.deleted_at)

  // --- Erledigte Aufgaben (Eingang + Unteraufgaben) ------------------------
  const doneTitles = [
    ...tasks.filter((t) => t.done && inWeek(t.done_at)).map((t) => t.title),
    ...subtasks.filter((s) => s.done && inWeek(s.done_at)).map((s) => s.title),
  ]

  // --- Ereignisse: laufende und in dieser Woche abgeschlossene -------------
  const previousRatio = new Map((input.previous?.events ?? []).map((e) => [e.id, e.ratio]))
  const reviewEvents = events
    .filter((e) => e.status === 'active' || inWeek(e.completed_at))
    .map((e) => {
      const ratio = progressRatio(
        e,
        subtasks.filter((s) => s.event_id === e.id),
        weekEnd,
      )
      const before = previousRatio.get(e.id)
      return {
        id: e.id,
        title: e.title,
        ratio,
        delta: ratio !== null && before !== undefined && before !== null ? ratio - before : null,
        completed: e.status !== 'active',
      }
    })

  // --- Gewohnheiten --------------------------------------------------------
  const checksByHabit = new Map<string, Set<string>>()
  for (const c of input.habit_checks) {
    if (c.deleted_at) continue
    if (!checksByHabit.has(c.habit_id)) checksByHabit.set(c.habit_id, new Set())
    checksByHabit.get(c.habit_id)!.add(c.date)
  }
  const habits = input.habits
    .filter((h) => !h.deleted_at && h.active && berlinDate(new Date(h.created_at)) <= weekEnd)
    .map((h) => {
      const checked = checksByHabit.get(h.id) ?? new Set<string>()
      const done = weekCount(checked, weekStart)
      if (h.frequency === 'daily') {
        // Mitten in der Woche angelegt: nur die Tage ab dem Anlegen zählen
        const created = berlinDate(new Date(h.created_at))
        const goal = created > weekStart ? 7 - daysBetween(weekStart, created) : 7
        return {
          id: h.id,
          title: h.title,
          frequency: h.frequency,
          done,
          goal,
          achieved: done >= goal,
          streak: dailyStreak(checked, weekEnd),
        }
      }
      const goal = h.times_per_week ?? 1
      return {
        id: h.id,
        title: h.title,
        frequency: h.frequency,
        done,
        goal,
        achieved: done >= goal,
        streak: weeklyStreak(checked, goal, weekEnd),
      }
    })

  // --- Liegengebliebenes: offene Aufgaben, die fällig waren oder älter als die Woche sind
  const leftover = tasks
    .filter(
      (t) =>
        !t.done &&
        ((t.due_date !== null && t.due_date <= weekEnd) || berlinDate(new Date(t.created_at)) < weekStart),
    )
    .map((t) => t.title)

  // --- Nächste Termine (14 Tage nach der Woche) ----------------------------
  const horizon = addDays(weekEnd, 14)
  const upcoming = events
    .filter((e) => e.progress_mode === 'countdown' && e.due_date !== null && e.due_date > weekEnd && e.due_date <= horizon)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .map((e) => ({ title: e.title, date: e.due_date! }))

  return {
    week_start: weekStart,
    week_end: weekEnd,
    tasks_done: { count: doneTitles.length, titles: doneTitles.slice(0, MAX_TITLES) },
    events: reviewEvents,
    habits,
    leftover: { count: leftover.length, titles: leftover.slice(0, MAX_TITLES) },
    upcoming,
  }
}
