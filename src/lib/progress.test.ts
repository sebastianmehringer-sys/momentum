import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countdownLabel, daysBetween } from './dates'
import type { EventItem, Subtask } from './db'
import { eventProgress, parseNumber } from './progress'

function event(patch: Partial<EventItem>): EventItem {
  return {
    id: 'e1',
    user_id: 'u1',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    category_id: null,
    title: 'Test',
    type: 'project',
    progress_mode: 'checklist',
    start_date: null,
    due_date: null,
    current_value: null,
    target_value: null,
    unit: null,
    note: null,
    source: 'manual',
    calendar_uid: null,
    status: 'active',
    completed_at: null,
    ...patch,
  }
}

function subtasks(done: number, total: number): Subtask[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `s${i}`,
    user_id: 'u1',
    created_at: '',
    updated_at: '',
    deleted_at: null,
    event_id: 'e1',
    title: `Aufgabe ${i}`,
    done: i < done,
    done_at: null,
    sort_order: i,
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0)) // 14.11.2026
})
afterEach(() => vi.useRealTimers())

describe('Datum', () => {
  it('zählt Tage auch über die Zeitumstellung richtig', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-11-14', '2026-11-26')).toBe(12)
    expect(daysBetween('2026-11-14', '2026-11-13')).toBe(-1)
  })
  it('beschriftet Countdowns', () => {
    expect(countdownLabel('2026-11-26')).toBe('noch 12 Tage')
    expect(countdownLabel('2026-11-15')).toBe('morgen')
    expect(countdownLabel('2026-11-14')).toBe('heute')
    expect(countdownLabel('2026-11-11')).toBe('vor 3 Tagen')
  })
})

describe('Fortschritt', () => {
  it('Checkliste: 3 von 5 = 60 %', () => {
    const p = eventProgress(event({}), subtasks(3, 5))
    expect(p.ratio).toBeCloseTo(0.6)
    expect(p.complete).toBe(false)
  })
  it('Checkliste: leer ist nicht erledigt, komplett ist erledigt', () => {
    expect(eventProgress(event({}), []).complete).toBe(false)
    expect(eventProgress(event({}), subtasks(4, 4)).complete).toBe(true)
  })
  it('Zahlenwert: 800 € von 2.000 €', () => {
    const p = eventProgress(event({ progress_mode: 'numeric', current_value: 800, target_value: 2000, unit: '€' }), [])
    expect(p.ratio).toBeCloseTo(0.4)
    expect(p.label).toBe('800 € von 2.000 €')
    expect(p.complete).toBe(false)
  })
  it('Zahlenwert: über dem Ziel bleibt bei 100 % und ist erledigt', () => {
    const p = eventProgress(event({ progress_mode: 'numeric', current_value: 2500, target_value: 2000 }), [])
    expect(p.ratio).toBe(1)
    expect(p.complete).toBe(true)
  })
  it('Zeit: (heute − Start) / (Ende − Start)', () => {
    const p = eventProgress(event({ progress_mode: 'time', start_date: '2026-11-04', due_date: '2026-11-24' }), [])
    expect(p.ratio).toBeCloseTo(0.5)
    expect(p.complete).toBe(false)
  })
  it('Zeit: am letzten Tag noch offen, am Tag danach erledigt', () => {
    const last = event({ progress_mode: 'time', start_date: '2026-11-01', due_date: '2026-11-14' })
    expect(eventProgress(last, []).complete).toBe(false)
    const over = event({ progress_mode: 'time', start_date: '2026-11-01', due_date: '2026-11-13' })
    expect(eventProgress(over, []).complete).toBe(true)
  })
  it('Termin ohne Checkliste: nur Countdown', () => {
    const p = eventProgress(event({ type: 'appointment', progress_mode: 'countdown', due_date: '2026-11-26' }), [])
    expect(p.ratio).toBeNull()
    expect(p.label).toBe('noch 12 Tage')
  })
  it('Termin mit Checkliste: Fortschritt nach Checkliste, erledigt erst wenn vorbei', () => {
    const e = event({ type: 'appointment', progress_mode: 'countdown', due_date: '2026-11-26' })
    const p = eventProgress(e, subtasks(2, 2))
    expect(p.ratio).toBe(1)
    expect(p.complete).toBe(false)
    expect(eventProgress({ ...e, due_date: '2026-11-13' }, []).complete).toBe(true)
  })
})

describe('Zahlen-Eingabe', () => {
  it('versteht deutsche und englische Schreibweise', () => {
    expect(parseNumber('2.000')).toBe(2000)
    expect(parseNumber('2000')).toBe(2000)
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('-50')).toBe(-50)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
})
