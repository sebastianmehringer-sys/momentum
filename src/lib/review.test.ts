import { describe, expect, it } from 'vitest'
import { berlinHour, longestDailyStreak, longestWeeklyStreak } from '../../supabase/functions/_shared/core.ts'
import { buildReview, type ReviewInput } from '../../supabase/functions/_shared/review.ts'

// Woche Mo 09.11. – So 15.11.2026
const WEEK = '2026-11-09'

const empty: ReviewInput = { events: [], subtasks: [], habits: [], habit_checks: [], inbox_tasks: [], previous: null }

const event = (patch: Partial<ReviewInput['events'][number]>): ReviewInput['events'][number] => ({
  id: 'e1',
  title: 'Ereignis',
  progress_mode: 'numeric',
  start_date: null,
  due_date: null,
  current_value: 800,
  target_value: 2000,
  status: 'active',
  completed_at: null,
  deleted_at: null,
  ...patch,
})

describe('Rekorde', () => {
  it('längster Tages-Streak', () => {
    const days = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'])
    expect(longestDailyStreak(days)).toBe(3)
    expect(longestDailyStreak(new Set())).toBe(0)
  })
  it('längster Wochen-Streak (2-mal pro Woche)', () => {
    const days = new Set([
      '2026-10-05', '2026-10-06', // Woche 1 geschafft
      '2026-10-12', '2026-10-18', // Woche 2 geschafft
      '2026-10-20', // Woche 3 nicht
      '2026-10-26', '2026-10-27', // Woche 4 geschafft
    ])
    expect(longestWeeklyStreak(days, 2)).toBe(2)
  })
})

describe('Berliner Uhrzeit', () => {
  it('rechnet Sommer- und Winterzeit richtig', () => {
    expect(berlinHour(new Date('2026-11-15T18:00:00Z'))).toBe(19) // Winterzeit
    expect(berlinHour(new Date('2026-07-12T17:00:00Z'))).toBe(19) // Sommerzeit
    expect(berlinHour(new Date('2026-07-12T22:30:00Z'))).toBe(0)
  })
})

describe('Wochenrückblick', () => {
  it('leere Daten ergeben einen leeren Rückblick', () => {
    const r = buildReview(empty, WEEK)
    expect(r.week_end).toBe('2026-11-15')
    expect(r.tasks_done.count).toBe(0)
    expect(r.events).toEqual([])
  })

  it('zählt erledigte Aufgaben und Unteraufgaben nur aus dieser Woche', () => {
    const r = buildReview(
      {
        ...empty,
        inbox_tasks: [
          { title: 'Diese Woche', due_date: null, done: true, done_at: '2026-11-10T10:00:00Z', created_at: '2026-11-09T08:00:00Z', deleted_at: null },
          { title: 'Letzte Woche', due_date: null, done: true, done_at: '2026-11-06T10:00:00Z', created_at: '2026-11-01T08:00:00Z', deleted_at: null },
          // Sonntag 23:30 Uhr Berliner Zeit gehört noch zur Woche
          { title: 'Sonntagnacht', due_date: null, done: true, done_at: '2026-11-15T22:30:00Z', created_at: '2026-11-09T08:00:00Z', deleted_at: null },
          { title: 'Gelöscht', due_date: null, done: true, done_at: '2026-11-10T10:00:00Z', created_at: '2026-11-09T08:00:00Z', deleted_at: '2026-11-11T00:00:00Z' },
        ],
        subtasks: [{ event_id: 'e1', title: 'Unteraufgabe', done: true, done_at: '2026-11-12T10:00:00Z', deleted_at: null }],
      },
      WEEK,
    )
    expect(r.tasks_done.count).toBe(3)
    expect(r.tasks_done.titles).toEqual(['Diese Woche', 'Sonntagnacht', 'Unteraufgabe'])
  })

  it('vergleicht den Fortschritt mit der Vorwoche', () => {
    const previous = buildReview({ ...empty, events: [event({ current_value: 500 })] }, '2026-11-02')
    const r = buildReview({ ...empty, events: [event({}), event({ id: 'neu', title: 'Neu' })], previous }, WEEK)
    expect(r.events[0].ratio).toBeCloseTo(0.4)
    expect(r.events[0].delta).toBeCloseTo(0.15)
    expect(r.events[1].delta).toBeNull()
  })

  it('zeigt in dieser Woche abgeschlossene Ereignisse, ältere nicht', () => {
    const r = buildReview(
      {
        ...empty,
        events: [
          event({ id: 'a', status: 'done', completed_at: '2026-11-11T12:00:00Z' }),
          event({ id: 'b', status: 'done', completed_at: '2026-10-01T12:00:00Z' }),
        ],
      },
      WEEK,
    )
    expect(r.events.map((e) => e.id)).toEqual(['a'])
    expect(r.events[0].completed).toBe(true)
  })

  it('wertet Gewohnheiten aus', () => {
    const r = buildReview(
      {
        ...empty,
        habits: [
          { id: 'gym', title: 'Gym', frequency: 'weekly', times_per_week: 3, active: true, created_at: '2026-10-01T08:00:00Z', deleted_at: null },
          { id: 'lesen', title: 'Lesen', frequency: 'daily', times_per_week: null, active: true, created_at: '2026-10-01T08:00:00Z', deleted_at: null },
          // Am Freitag angelegt: nur Fr, Sa, So zählen
          { id: 'neu', title: 'Neu', frequency: 'daily', times_per_week: null, active: true, created_at: '2026-11-13T08:00:00Z', deleted_at: null },
        ],
        habit_checks: [
          ...['2026-11-09', '2026-11-11', '2026-11-13'].map((date) => ({ habit_id: 'gym', date, deleted_at: null })),
          ...['2026-11-09', '2026-11-10', '2026-11-14', '2026-11-15'].map((date) => ({ habit_id: 'lesen', date, deleted_at: null })),
          ...['2026-11-13', '2026-11-14', '2026-11-15'].map((date) => ({ habit_id: 'neu', date, deleted_at: null })),
        ],
      },
      WEEK,
    )
    const [gym, lesen, neu] = r.habits
    expect(gym).toMatchObject({ done: 3, goal: 3, achieved: true, streak: 1 })
    expect(lesen).toMatchObject({ done: 4, goal: 7, achieved: false, streak: 2 })
    expect(neu).toMatchObject({ done: 3, goal: 3, achieved: true, streak: 3 })
  })

  it('findet Liegengebliebenes und die nächsten Termine', () => {
    const r = buildReview(
      {
        ...empty,
        inbox_tasks: [
          { title: 'Überfällig', due_date: '2026-11-12', done: false, done_at: null, created_at: '2026-11-10T08:00:00Z', deleted_at: null },
          { title: 'Alt', due_date: null, done: false, done_at: null, created_at: '2026-10-20T08:00:00Z', deleted_at: null },
          { title: 'Frisch', due_date: null, done: false, done_at: null, created_at: '2026-11-13T08:00:00Z', deleted_at: null },
        ],
        events: [
          event({ id: 't1', title: 'Bald', progress_mode: 'countdown', due_date: '2026-11-27' }),
          event({ id: 't2', title: 'Weit weg', progress_mode: 'countdown', due_date: '2027-03-01' }),
        ],
      },
      WEEK,
    )
    expect(r.leftover.titles).toEqual(['Überfällig', 'Alt'])
    expect(r.upcoming).toEqual([{ title: 'Bald', date: '2026-11-27' }])
  })
})
