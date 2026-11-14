import { db, SYNC_TABLES, type OutboxEntry, type TableName } from './db'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Sync-Status (für das Wolken-Symbol)
// ---------------------------------------------------------------------------
export type SyncState = 'synced' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  pending: number
  lastSync: string | null
  error: string | null
}

let status: SyncStatus = {
  state: navigator.onLine ? 'synced' : 'offline',
  pending: 0,
  lastSync: null,
  error: null,
}
const listeners = new Set<() => void>()

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeSyncStatus(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSyncStatus() {
  return status
}

// ---------------------------------------------------------------------------
// Hochladen: Outbox -> Supabase
// ---------------------------------------------------------------------------
async function push() {
  const d = db()
  const entries = await d.outbox.orderBy('seq').toArray()
  if (entries.length === 0) return

  for (const { name, pk } of SYNC_TABLES) {
    const mine = entries.filter((e) => e.table === name)
    if (mine.length === 0) continue

    const keys = [...new Set(mine.map((e) => e.key))]
    const rows = (await d.table(name).bulkGet(keys)).filter(Boolean)
    if (rows.length > 0) {
      // synced_at vergibt der Server selbst
      const payload = rows.map(({ synced_at: _ignored, ...rest }) => rest)
      const { error } = await supabase.from(name).upsert(payload, { onConflict: pk })
      if (error) throw new Error(`${name}: ${error.message}`)
    }
    // Nur die Einträge löschen, die wir gelesen haben. Kam inzwischen eine
    // neue Änderung dazu, hat sie eine höhere Nummer und bleibt stehen.
    await d.outbox.bulkDelete(mine.map((e) => e.seq!))
  }
}

// ---------------------------------------------------------------------------
// Abholen: Supabase -> lokal (alles, was seit dem letzten Mal geändert wurde)
// ---------------------------------------------------------------------------
const PAGE = 500
const OVERLAP_MS = 5000 // kleine Überlappung, damit nichts durchrutscht

async function pull() {
  const d = db()
  for (const { name, pk } of SYNC_TABLES) {
    const metaKey = `cursor:${name}`
    const stored = (await d.meta.get(metaKey))?.value
    let cursor = stored ? new Date(Date.parse(stored) - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z'
    let newest = stored ?? null

    for (;;) {
      const { data, error } = await supabase
        .from(name)
        .select('*')
        .gt('synced_at', cursor)
        .order('synced_at', { ascending: true })
        .limit(PAGE)
      if (error) throw new Error(`${name}: ${error.message}`)
      if (!data || data.length === 0) break

      await d.transaction('rw', d.table(name), d.outbox, async () => {
        for (const remote of data) {
          const key = remote[pk] as string
          const local = await d.table(name).get(key)
          // last write wins: eine neuere lokale Änderung bleibt stehen
          if (local && Date.parse(local.updated_at) > Date.parse(remote.updated_at)) continue
          await d.table(name).put(remote)
        }
      })

      cursor = data[data.length - 1].synced_at
      newest = cursor
      if (data.length < PAGE) break
    }

    if (newest && newest !== stored) await d.meta.put({ key: metaKey, value: newest })
  }
}

// ---------------------------------------------------------------------------
// Wochenrückblicke: entstehen auf dem Server, die App holt sie nur ab
// ---------------------------------------------------------------------------
const REVIEW_INTERVAL_MS = 10 * 60_000
let lastReviewPull = 0

async function pullReviews(force = false) {
  if (!force && Date.now() - lastReviewPull < REVIEW_INTERVAL_MS) return
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(104)
  if (error) throw new Error(`weekly_reviews: ${error.message}`)
  await db().weekly_reviews.bulkPut(data ?? [])
  lastReviewPull = Date.now()
}

/** Holt die Rückblicke sofort ab (z. B. direkt nach dem Erstellen). */
export async function refreshReviews() {
  await pullReviews(true)
}

// ---------------------------------------------------------------------------
// Steuerung
// ---------------------------------------------------------------------------
let running = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

async function refreshPending() {
  try {
    setStatus({ pending: await db().outbox.count() })
  } catch {
    /* nicht angemeldet */
  }
}

/** Führt sofort einen Abgleich aus (hochladen, dann abholen). */
export async function syncNow() {
  if (running) {
    again = true
    return
  }
  if (!navigator.onLine) {
    await refreshPending()
    setStatus({ state: 'offline' })
    return
  }
  running = true
  setStatus({ state: 'syncing', error: null })
  try {
    await push()
    await pull()
    await pullReviews()
    setStatus({ state: 'synced', lastSync: new Date().toISOString() })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Sync fehlgeschlagen:', message)
    // Kein Netz (auch wenn das Gerät sich für „online“ hält, z. B. schwaches WLAN) ist kein Fehler
    const noNetwork = !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed/i.test(message)
    setStatus(noNetwork ? { state: 'offline' } : { state: 'error', error: message })
  } finally {
    running = false
    await refreshPending()
    if (again) {
      again = false
      void syncNow()
    }
  }
}

/** Wie syncNow, wartet aber, bis ein gerade laufender Abgleich fertig ist. */
export async function syncAndWait() {
  while (running) await new Promise((resolve) => setTimeout(resolve, 100))
  await syncNow()
}

/** Abgleich kurz verzögert anstoßen (z. B. nach jeder lokalen Änderung). */
export function requestSync(delay = 800) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
  void refreshPending()
}

/** Startet den automatischen Abgleich. Gibt eine Funktion zum Beenden zurück. */
export function startSync() {
  const onOnline = () => void syncNow()
  const onOffline = () => setStatus({ state: 'offline' })
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 30_000)

  void syncNow()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(interval)
    clearTimeout(timer)
  }
}

export type { OutboxEntry, TableName }
