// Rechenkern, den App (src/lib) und Edge Functions gemeinsam nutzen.
// Bewusst ohne jeden Import, damit er im Browser und auf dem Server läuft.
// Datumsangaben sind Texte im Format JJJJ-MM-TT.

function utc(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Anzahl Tage von a bis b (negativ, wenn b vor a liegt) */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** Datum um n Tage verschieben (n darf negativ sein) */
export function addDays(s: string, n: number): string {
  return new Date(utc(s) + n * 86_400_000).toISOString().slice(0, 10)
}

/** Montag der Woche, in der das Datum liegt (Woche = Mo–So) */
export function weekStart(s: string): string {
  const weekday = (new Date(utc(s)).getUTCDay() + 6) % 7 // Mo = 0 … So = 6
  return addDays(s, -weekday)
}

/** Datum eines Zeitpunkts in Berliner Zeit (berücksichtigt Sommer-/Winterzeit) */
export function berlinDate(d: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d)
}

/** Stunde (0–23) eines Zeitpunkts in Berliner Zeit */
export function berlinHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(d))
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

/** Wie oft in der Woche von `day` abgehakt wurde (Mo–So) */
export function weekCount(checked: Set<string>, day: string): number {
  const monday = weekStart(day)
  let count = 0
  for (let i = 0; i < 7; i++) if (checked.has(addDays(monday, i))) count++
  return count
}

/**
 * Tägliche Gewohnheit: Tage am Stück mit Häkchen.
 * Ist heute noch offen, bricht das den Streak nicht (gezählt wird dann bis gestern).
 */
export function dailyStreak(checked: Set<string>, today: string): number {
  let day = checked.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (checked.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

/**
 * Wöchentliche Gewohnheit: Wochen am Stück, in denen das Ziel erreicht wurde.
 * Die laufende Woche zählt mit, sobald das Ziel erreicht ist, bricht den Streak aber nicht.
 */
export function weeklyStreak(checked: Set<string>, timesPerWeek: number, today: string): number {
  const goal = Math.max(1, timesPerWeek)
  let streak = weekCount(checked, today) >= goal ? 1 : 0
  let monday = addDays(weekStart(today), -7)
  while (weekCount(checked, monday) >= goal) {
    streak++
    monday = addDays(monday, -7)
  }
  return streak
}

/** Längste Folge von Tagen am Stück, die es je gab */
export function longestDailyStreak(checked: Set<string>): number {
  let best = 0
  for (const day of checked) {
    if (checked.has(addDays(day, -1))) continue // nur am Anfang einer Folge zählen
    let length = 1
    while (checked.has(addDays(day, length))) length++
    best = Math.max(best, length)
  }
  return best
}

/** Längste Folge von Wochen am Stück mit erreichtem Ziel, die es je gab */
export function longestWeeklyStreak(checked: Set<string>, timesPerWeek: number): number {
  const goal = Math.max(1, timesPerWeek)
  const perWeek = new Map<string, number>()
  for (const day of checked) {
    const monday = weekStart(day)
    perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1)
  }
  const reached = new Set([...perWeek].filter(([, n]) => n >= goal).map(([monday]) => monday))
  let best = 0
  for (const monday of reached) {
    if (reached.has(addDays(monday, -7))) continue
    let length = 1
    while (reached.has(addDays(monday, length * 7))) length++
    best = Math.max(best, length)
  }
  return best
}

// ---------------------------------------------------------------------------
// Fortschritt (nur die Zahl; die Beschriftung macht die App)
// ---------------------------------------------------------------------------
export interface ProgressInput {
  progress_mode: string
  start_date: string | null
  due_date: string | null
  current_value: number | null
  target_value: number | null
}

/** Fortschritt 0–1, oder null wenn es nichts zu messen gibt (Termin ohne Checkliste) */
export function progressRatio(event: ProgressInput, subtasks: { done: boolean }[], today: string): number | null {
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  const checklist = () => (subtasks.length > 0 ? subtasks.filter((s) => s.done).length / subtasks.length : 0)

  switch (event.progress_mode) {
    case 'checklist':
      return checklist()
    case 'numeric': {
      const target = Number(event.target_value ?? 0)
      return target > 0 ? clamp(Number(event.current_value ?? 0) / target) : 0
    }
    case 'time': {
      if (!event.start_date || !event.due_date) return 0
      const total = daysBetween(event.start_date, event.due_date)
      return total > 0 ? clamp(daysBetween(event.start_date, today) / total) : 1
    }
    case 'countdown':
      return subtasks.length > 0 ? checklist() : null
    default:
      return null
  }
}
