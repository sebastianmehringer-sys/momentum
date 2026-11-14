import { countdownLabel, daysBetween, today } from './dates'
import type { EventItem, Subtask } from './db'

export interface Progress {
  /** 0 bis 1, oder null wenn es nichts zu messen gibt (Termin ohne Checkliste) */
  ratio: number | null
  /** Kurztext, z. B. „3/5“ oder „800 € von 2.000 €“ */
  label: string
  /** true, wenn das Ereignis als erledigt gilt */
  complete: boolean
}

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

export function formatNumber(n: number): string {
  return numberFormat.format(n)
}

/** Zahl aus einem Textfeld lesen: „2.000“, „2000“, „12,5“ und „12.5“ funktionieren alle. */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/\s/g, '')
  if (s === '') return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function checklist(subtasks: Subtask[]) {
  const total = subtasks.length
  const done = subtasks.filter((s) => s.done).length
  return { total, done, ratio: total > 0 ? done / total : 0 }
}

/** Berechnet den Fortschritt eines Ereignisses aus seinen (nicht gelöschten) Unteraufgaben. */
export function eventProgress(event: EventItem, subtasks: Subtask[]): Progress {
  const now = today()

  switch (event.progress_mode) {
    case 'checklist': {
      const c = checklist(subtasks)
      return {
        ratio: c.ratio,
        label: c.total > 0 ? `${c.done}/${c.total} erledigt` : 'Noch keine Unteraufgaben',
        complete: c.total > 0 && c.done === c.total,
      }
    }
    case 'numeric': {
      const current = event.current_value ?? 0
      const target = event.target_value ?? 0
      const unit = event.unit ? ` ${event.unit}` : ''
      return {
        ratio: target > 0 ? clamp(current / target) : 0,
        label: `${formatNumber(current)}${unit} von ${formatNumber(target)}${unit}`,
        complete: target > 0 && current >= target,
      }
    }
    case 'time': {
      if (!event.start_date || !event.due_date) return { ratio: 0, label: 'Zeitraum fehlt', complete: false }
      const total = daysBetween(event.start_date, event.due_date)
      const passed = daysBetween(event.start_date, now)
      const left = daysBetween(now, event.due_date)
      return {
        ratio: total > 0 ? clamp(passed / total) : 1,
        label: passed < 0 ? `beginnt ${countdownLabel(event.start_date)}` : left >= 0 ? countdownLabel(event.due_date) : 'vorbei',
        complete: left < 0,
      }
    }
    case 'countdown': {
      const past = event.due_date ? daysBetween(now, event.due_date) < 0 : false
      const when = event.due_date ? countdownLabel(event.due_date) : 'ohne Datum'
      if (subtasks.length > 0) {
        // Termin mit eigener Checkliste: der Fortschritt richtet sich nach der Checkliste
        const c = checklist(subtasks)
        return { ratio: c.ratio, label: `${when} · ${c.done}/${c.total} erledigt`, complete: past }
      }
      return { ratio: null, label: when, complete: past }
    }
  }
}
