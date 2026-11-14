import { describe, expect, it } from 'vitest'
import {
  nextOccurrence,
  parseIcal,
  planSync,
  type ExistingEvent,
} from '../../supabase/functions/sync-calendar/ical.ts'

const TODAY = '2026-11-14'

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261126',
  'DTEND;VALUE=DATE:20261127',
  'UID:ganztag@google.com',
  'SUMMARY:Zwischenprüfung',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261231T233000Z',
  'UID:silvester@google.com',
  'SUMMARY:Feier\\, Raketen\\; Sekt und ein sehr langer Titel der im iCal-For',
  ' mat umgebrochen wird',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Europe/Berlin:20261201T180000',
  'UID:abend@google.com',
  'SUMMARY:Elternabend',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261120',
  'UID:abgesagt@google.com',
  'SUMMARY:Fällt aus',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20200310',
  'RRULE:FREQ=YEARLY',
  'UID:geburtstag@google.com',
  'SUMMARY:Geburtstag',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('iCal lesen', () => {
  const events = parseIcal(ICS, TODAY)
  const byUid = Object.fromEntries(events.map((e) => [e.uid, e]))

  it('liest ganztägige Termine', () => {
    expect(byUid['ganztag@google.com']).toEqual({
      uid: 'ganztag@google.com',
      title: 'Zwischenprüfung',
      date: '2026-11-26',
    })
  })
  it('rechnet Weltzeit in den Berliner Tag um (23:30 UTC ist schon der nächste Tag)', () => {
    expect(byUid['silvester@google.com'].date).toBe('2027-01-01')
  })
  it('setzt umgebrochene Zeilen zusammen und entfernt Schutzzeichen', () => {
    expect(byUid['silvester@google.com'].title).toBe(
      'Feier, Raketen; Sekt und ein sehr langer Titel der im iCal-Format umgebrochen wird',
    )
  })
  it('nimmt bei Terminen mit Zeitzone den Kalendertag', () => {
    expect(byUid['abend@google.com'].date).toBe('2026-12-01')
  })
  it('lässt abgesagte Termine weg', () => {
    expect(byUid['abgesagt@google.com']).toBeUndefined()
  })
  it('zeigt bei Serien das nächste Vorkommen', () => {
    expect(byUid['geburtstag@google.com'].date).toBe('2027-03-10')
  })
})

describe('Serientermine', () => {
  it('wöchentlich', () => {
    expect(nextOccurrence('2026-11-02', 'FREQ=WEEKLY', TODAY)).toBe('2026-11-16')
    expect(nextOccurrence('2026-11-02', 'FREQ=WEEKLY;INTERVAL=2', TODAY)).toBe('2026-11-16')
    expect(nextOccurrence('2026-11-14', 'FREQ=WEEKLY', TODAY)).toBe('2026-11-14')
  })
  it('monatlich überspringt Monate ohne den Tag', () => {
    expect(nextOccurrence('2026-01-31', 'FREQ=MONTHLY', '2026-02-01')).toBe('2026-03-31')
  })
  it('beachtet Enddatum und Anzahl (dann bleibt das letzte Vorkommen)', () => {
    expect(nextOccurrence('2026-10-01', 'FREQ=WEEKLY;UNTIL=20261020T220000Z', TODAY)).toBe('2026-10-15')
    expect(nextOccurrence('2026-10-01', 'FREQ=DAILY;COUNT=3', TODAY)).toBe('2026-10-03')
  })
})

describe('Abgleich planen', () => {
  const existing = (patch: Partial<ExistingEvent>): ExistingEvent => ({
    id: 'id1',
    calendar_uid: 'a',
    title: 'Alt',
    due_date: '2026-11-20',
    status: 'active',
    deleted_at: null,
    ...patch,
  })

  it('legt neue künftige Termine an, vergangene nicht', () => {
    const plan = planSync(
      [],
      [
        { uid: 'neu', title: 'Neu', date: '2026-11-20' },
        { uid: 'alt', title: 'Längst vorbei', date: '2026-01-01' },
      ],
      TODAY,
    )
    expect(plan.insert.map((p) => p.uid)).toEqual(['neu'])
  })
  it('aktualisiert Titel und Datum', () => {
    const plan = planSync([existing({})], [{ uid: 'a', title: 'Neu', date: '2026-11-25' }], TODAY)
    expect(plan.update).toEqual([{ id: 'id1', title: 'Neu', due_date: '2026-11-25', status: 'active' }])
  })
  it('ändert nichts, wenn alles gleich ist', () => {
    const plan = planSync([existing({})], [{ uid: 'a', title: 'Alt', date: '2026-11-20' }], TODAY)
    expect(plan).toEqual({ insert: [], update: [], remove: [], archive: [] })
  })
  it('vergangene Termine wandern ins Archiv', () => {
    const plan = planSync(
      [existing({ due_date: '2026-11-10' })],
      [{ uid: 'a', title: 'Alt', date: '2026-11-10' }],
      TODAY,
    )
    expect(plan.update[0].status).toBe('done')
  })
  it('im Kalender gelöscht: künftige verschwinden, vergangene bleiben im Archiv', () => {
    const plan = planSync(
      [existing({ id: 'kuenftig' }), existing({ id: 'vorbei', calendar_uid: 'b', due_date: '2026-11-01' })],
      [],
      TODAY,
    )
    expect(plan.remove).toEqual(['kuenftig'])
    expect(plan.archive).toEqual(['vorbei'])
  })
  it('in der App gelöschte Termine kommen nicht zurück', () => {
    const plan = planSync(
      [existing({ deleted_at: '2026-11-13T10:00:00Z' })],
      [{ uid: 'a', title: 'Alt', date: '2026-11-20' }],
      TODAY,
    )
    expect(plan).toEqual({ insert: [], update: [], remove: [], archive: [] })
  })
})
