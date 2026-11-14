import { addDays, weekStart } from './dates'
import type { Habit } from './db'

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

export interface HabitState {
  streak: number
  /** „12 Tage“ bzw. „3 Wochen“ */
  streakLabel: string
  doneToday: boolean
  /** Häkchen in dieser Woche */
  thisWeek: number
  /** Ziel pro Woche (täglich = 7) */
  weeklyGoal: number
  /** Für heute nichts mehr zu tun (abgehakt oder Wochenziel schon erreicht) */
  satisfied: boolean
}

export function habitState(habit: Habit, checked: Set<string>, today: string): HabitState {
  const doneToday = checked.has(today)
  const thisWeek = weekCount(checked, today)

  if (habit.frequency === 'daily') {
    const streak = dailyStreak(checked, today)
    return {
      streak,
      streakLabel: `${streak} ${streak === 1 ? 'Tag' : 'Tage'}`,
      doneToday,
      thisWeek,
      weeklyGoal: 7,
      satisfied: doneToday,
    }
  }

  const weeklyGoal = habit.times_per_week ?? 1
  const streak = weeklyStreak(checked, weeklyGoal, today)
  return {
    streak,
    streakLabel: `${streak} ${streak === 1 ? 'Woche' : 'Wochen'}`,
    doneToday,
    thisWeek,
    weeklyGoal,
    satisfied: doneToday || thisWeek >= weeklyGoal,
  }
}
