import { describe, expect, it } from 'vitest'
import {
  buildCandidates,
  selectToSend,
  type Clock,
  type NotifyInput,
} from '../../supabase/functions/_shared/notify.ts'

// Samstag, 14.11.2026
const clock = (hour: number, patch: Partial<Clock> = {}): Clock => ({
  now: new Date('2026-11-14T12:00:00Z'),
  today: '2026-11-14',
  hour,
  isSunday: false,
  monday: '2026-11-09',
  ...patch,
})

const allOn = { notify_evening: true, notify_countdown: true, notify_achievement: true, notify_weekly: true }
const base: NotifyInput = {
  settings: allOn,
  events: [],
  subtasks: [],
  habits: [],
  habit_checks: [],
  hasReviewThisWeek: false,
}

const habit = (id: string, frequency: 'daily' | 'weekly' = 'daily', times: number | null = null) => ({
  id,
  title: id,
  frequency,
  times_per_week: times,
  active: true,
  deleted_at: null,
})
const checks = (habit_id: string, ...dates: string[]) => dates.map((date) => ({ habit_id, date, deleted_at: null }))
const appointment = (id: string, due_date: string) => ({
  id,
  title: id,
  type: 'appointment',
  progress_mode: 'countdown',
  due_date,
  status: 'active',
  completed_at: null,
  deleted_at: null,
})
const daysBefore = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, 13 - i)).toISOString().slice(0, 10))

describe('Abend-Check', () => {
  const input: NotifyInput = {
    ...base,
    habits: [habit('Lesen'), habit('Gym', 'weekly', 3)],
    habit_checks: checks('Lesen', ...daysBefore(12)),
  }

  it('kommt um 20 Uhr mit Anzahl und Streak', () => {
    const [c] = buildCandidates(input, clock(20))
    expect(c.kind).toBe('evening')
    expect(c.body).toBe('Noch 2 Gewohnheiten offen – Streak: 12 Tage 🔥')
  })
  it('kommt nicht zu anderen Uhrzeiten', () => {
    expect(buildCandidates(input, clock(19))).toEqual([])
    expect(buildCandidates(input, clock(21))).toEqual([])
  })
  it('kommt nicht, wenn alles erledigt ist', () => {
    const done: NotifyInput = {
      ...input,
      habit_checks: [
        ...checks('Lesen', '2026-11-14'),
        // Wochenziel 3-mal schon erreicht, heute nicht nötig
        ...checks('Gym', '2026-11-09', '2026-11-10', '2026-11-11'),
      ],
    }
    expect(buildCandidates(done, clock(20))).toEqual([])
  })
  it('Einzahl ohne Streak', () => {
    const one: NotifyInput = { ...base, habits: [habit('Lesen')] }
    expect(buildCandidates(one, clock(20))[0].body).toBe('Noch 1 Gewohnheit offen')
  })
  it('ist abschaltbar', () => {
    const off = { ...input, settings: { ...allOn, notify_evening: false } }
    expect(buildCandidates(off, clock(20))).toEqual([])
  })
})

describe('Countdown', () => {
  const input: NotifyInput = {
    ...base,
    events: [appointment('Prüfung', '2026-11-15'), appointment('Urlaub', '2026-11-21'), appointment('Später', '2026-12-24')],
    subtasks: [
      { event_id: 'Prüfung', done: true, deleted_at: null },
      { event_id: 'Prüfung', done: false, deleted_at: null },
    ],
  }
  it('kommt um 9 Uhr für morgen (mit Checklisten-Stand) und in 7 Tagen', () => {
    const c = buildCandidates(input, clock(9))
    expect(c.map((x) => x.kind)).toEqual(['countdown1', 'countdown7'])
    expect(c[0].body).toBe('Prüfung (1/2 erledigt)')
    expect(c[0].url).toBe('/ereignisse/Prüfung')
    expect(c[1].body).toBe('Urlaub')
  })
  it('kommt nicht zu anderen Uhrzeiten', () => {
    expect(buildCandidates(input, clock(10))).toEqual([])
  })
})

describe('Erfolg', () => {
  it('meldet ein frisch erreichtes Ziel, aber keine vergangenen Termine', () => {
    const input: NotifyInput = {
      ...base,
      events: [
        { ...appointment('Sparziel', '2026-12-01'), type: 'savings', progress_mode: 'numeric', status: 'done', completed_at: '2026-11-14T11:00:00Z' },
        { ...appointment('Alter Termin', '2026-11-13'), status: 'done', completed_at: '2026-11-14T11:00:00Z' },
        { ...appointment('Lange her', '2026-11-01'), type: 'project', status: 'done', completed_at: '2026-11-10T11:00:00Z' },
      ],
    }
    const c = buildCandidates(input, clock(13))
    expect(c.map((x) => x.ref)).toEqual(['event:Sparziel'])
  })
  it('meldet Streak-Meilensteine 7, 30 und 100, aber nichts dazwischen', () => {
    const streak = (n: number): NotifyInput => ({
      ...base,
      habits: [habit('Lesen')],
      habit_checks: checks('Lesen', '2026-11-14', ...daysBefore(n - 1)),
    })
    expect(buildCandidates(streak(7), clock(13))[0].title).toBe('7 Tage am Stück 🔥')
    expect(buildCandidates(streak(30), clock(13))).toHaveLength(1)
    expect(buildCandidates(streak(8), clock(13))).toEqual([])
  })
  it('meldet den Meilenstein erst, wenn heute abgehakt ist', () => {
    const input: NotifyInput = { ...base, habits: [habit('Lesen')], habit_checks: checks('Lesen', ...daysBefore(7)) }
    expect(buildCandidates(input, clock(13))).toEqual([])
  })
})

describe('Wochenrückblick', () => {
  const sunday = clock(19, { today: '2026-11-15', isSunday: true })
  it('kommt Sonntag 19 Uhr, wenn der Rückblick da ist', () => {
    expect(buildCandidates({ ...base, hasReviewThisWeek: true }, sunday)[0].kind).toBe('weekly')
    expect(buildCandidates(base, sunday)).toEqual([])
    expect(buildCandidates({ ...base, hasReviewThisWeek: true }, clock(19))).toEqual([])
  })
})

describe('Tageslimit und Reihenfolge', () => {
  const c = (kind: 'achievement' | 'countdown1' | 'evening' | 'countdown7' | 'weekly', ref = 'r') => ({
    kind,
    ref,
    title: '',
    body: '',
    url: '/',
  })
  const withHabit: NotifyInput = { ...base, habits: [habit('Lesen')] }

  it('sendet nichts doppelt', () => {
    expect(selectToSend([c('evening')], new Set(['evening|r']), 0, base, clock(20))).toEqual([])
  })
  it('sendet nie mehr als 2 pro Tag', () => {
    const many = [c('achievement', 'a'), c('achievement', 'b'), c('achievement', 'c')]
    expect(selectToSend(many, new Set(), 0, base, clock(13))).toHaveLength(2)
    expect(selectToSend(many, new Set(), 1, base, clock(13))).toHaveLength(1)
    expect(selectToSend(many, new Set(), 2, base, clock(13))).toHaveLength(0)
  })
  it('nimmt das Wichtigste zuerst', () => {
    const chosen = selectToSend([c('countdown7'), c('evening'), c('achievement')], new Set(), 0, base, clock(20))
    expect(chosen.map((x) => x.kind)).toEqual(['achievement', 'evening'])
  })
  it('hält morgens einen Platz für den Abend-Check frei', () => {
    // 9 Uhr: Countdown 1 Tag und 7 Tage fällig, abends kann noch der Abend-Check kommen
    const chosen = selectToSend([c('countdown7'), c('countdown1')], new Set(), 0, withHabit, clock(9))
    expect(chosen.map((x) => x.kind)).toEqual(['countdown1'])
  })
  it('ohne Gewohnheiten wird kein Platz freigehalten', () => {
    const chosen = selectToSend([c('countdown7'), c('countdown1')], new Set(), 0, base, clock(9))
    expect(chosen.map((x) => x.kind)).toEqual(['countdown1', 'countdown7'])
  })
  it('Wochenrückblick weicht dem Abend-Check, wenn schon eine gesendet wurde', () => {
    const sunday = clock(19, { isSunday: true })
    expect(selectToSend([c('weekly')], new Set(), 1, withHabit, sunday)).toEqual([])
    expect(selectToSend([c('weekly')], new Set(), 0, withHabit, sunday)).toHaveLength(1)
  })
})
