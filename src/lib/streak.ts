import {
  dailyStreak,
  longestDailyStreak,
  longestWeeklyStreak,
  weekCount,
  weeklyStreak,
} from '../../supabase/functions/_shared/core.ts'
import type { Habit } from './db'

// Die Rechenfunktionen teilen sich App und Server
export { dailyStreak, longestDailyStreak, longestWeeklyStreak, weekCount, weeklyStreak }

export interface HabitState {
  streak: number
  /** „12 Tage“ bzw. „3 Wochen“ */
  streakLabel: string
  /** Längster Streak, den es je gab */
  longest: number
  longestLabel: string
  doneToday: boolean
  /** Häkchen in dieser Woche */
  thisWeek: number
  /** Ziel pro Woche (täglich = 7) */
  weeklyGoal: number
  /** Für heute nichts mehr zu tun (abgehakt oder Wochenziel schon erreicht) */
  satisfied: boolean
}

const days = (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`
const weeks = (n: number) => `${n} ${n === 1 ? 'Woche' : 'Wochen'}`

export function habitState(habit: Habit, checked: Set<string>, today: string): HabitState {
  const doneToday = checked.has(today)
  const thisWeek = weekCount(checked, today)

  if (habit.frequency === 'daily') {
    const streak = dailyStreak(checked, today)
    const longest = longestDailyStreak(checked)
    return {
      streak,
      streakLabel: days(streak),
      longest,
      longestLabel: days(longest),
      doneToday,
      thisWeek,
      weeklyGoal: 7,
      satisfied: doneToday,
    }
  }

  const weeklyGoal = habit.times_per_week ?? 1
  const streak = weeklyStreak(checked, weeklyGoal, today)
  const longest = longestWeeklyStreak(checked, weeklyGoal)
  return {
    streak,
    streakLabel: weeks(streak),
    longest,
    longestLabel: weeks(longest),
    doneToday,
    thisWeek,
    weeklyGoal,
    satisfied: doneToday || thisWeek >= weeklyGoal,
  }
}
