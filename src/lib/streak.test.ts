import { describe, expect, it } from 'vitest'
import { addDays, weekStart } from './dates'
import { dailyStreak, weekCount, weeklyStreak } from './streak'

// Samstag, 14.11.2026 – die Woche läuft von Mo 09.11. bis So 15.11.
const TODAY = '2026-11-14'

const set = (...days: string[]) => new Set(days)

describe('Datum-Helfer', () => {
  it('Woche beginnt am Montag', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-09')
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09')
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
  })
  it('addDays funktioniert über Monats- und Jahresgrenzen und die Zeitumstellung', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })
})

describe('Täglicher Streak', () => {
  it('ohne Häkchen = 0', () => {
    expect(dailyStreak(set(), TODAY)).toBe(0)
  })
  it('zählt Tage am Stück bis heute', () => {
    expect(dailyStreak(set('2026-11-12', '2026-11-13', '2026-11-14'), TODAY)).toBe(3)
  })
  it('heute noch offen bricht den Streak nicht', () => {
    expect(dailyStreak(set('2026-11-11', '2026-11-12', '2026-11-13'), TODAY)).toBe(3)
  })
  it('gestern verpasst = Streak weg', () => {
    expect(dailyStreak(set('2026-11-10', '2026-11-11', '2026-11-12'), TODAY)).toBe(0)
  })
  it('gestern verpasst, heute neu begonnen = 1', () => {
    expect(dailyStreak(set('2026-11-11', '2026-11-12', '2026-11-14'), TODAY)).toBe(1)
  })
  it('eine Lücke beendet die Zählung', () => {
    expect(dailyStreak(set('2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'), TODAY)).toBe(2)
  })
})

describe('Wöchentlicher Streak (3-mal pro Woche)', () => {
  const lastWeek = ['2026-11-02', '2026-11-04', '2026-11-08'] // Mo, Mi, So
  const twoWeeksAgo = ['2026-10-26', '2026-10-27', '2026-10-28']

  it('zählt Häkchen der Woche von Montag bis Sonntag', () => {
    expect(weekCount(set(...lastWeek, '2026-11-09'), '2026-11-05')).toBe(3)
    expect(weekCount(set(...lastWeek, '2026-11-09'), TODAY)).toBe(1)
  })
  it('laufende Woche noch nicht geschafft bricht den Streak nicht', () => {
    expect(weeklyStreak(set(...twoWeeksAgo, ...lastWeek, '2026-11-09'), 3, TODAY)).toBe(2)
  })
  it('laufende Woche zählt mit, sobald das Ziel erreicht ist', () => {
    const thisWeek = ['2026-11-09', '2026-11-11', '2026-11-13']
    expect(weeklyStreak(set(...twoWeeksAgo, ...lastWeek, ...thisWeek), 3, TODAY)).toBe(3)
  })
  it('letzte Woche verpasst = Streak weg', () => {
    expect(weeklyStreak(set(...twoWeeksAgo, '2026-11-02', '2026-11-04'), 3, TODAY)).toBe(0)
  })
  it('letzte Woche verpasst, diese Woche geschafft = 1', () => {
    const thisWeek = ['2026-11-09', '2026-11-11', '2026-11-13']
    expect(weeklyStreak(set(...twoWeeksAgo, ...thisWeek), 3, TODAY)).toBe(1)
  })
  it('mehr als nötig zählt trotzdem nur als eine Woche', () => {
    const many = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']
    expect(weeklyStreak(set(...many), 3, TODAY)).toBe(1)
  })
})
