// Edge Function "sync-calendar"
// Lädt die geheime iCal-Adresse serverseitig (im Browser verhindert das CORS) und
// gleicht die Termine mit der Tabelle "events" ab.
//
// Zwei Aufrufarten:
//  - aus der App (Knopf "Jetzt abgleichen"): mit dem Login des Nutzers, nur für ihn
//  - stündlich per pg_cron: mit dem Header x-cron-secret, für alle Nutzer mit iCal-Adresse

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { berlinDate, parseIcal, planSync, type ExistingEvent } from './ical.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface Result {
  added: number
  updated: number
  removed: number
  total: number
}

async function syncUser(admin: SupabaseClient, userId: string, icalUrl: string): Promise<Result> {
  // Nur Google-Kalender-Adressen abrufen
  let url: URL
  try {
    url = new URL(icalUrl.trim())
  } catch {
    throw new Error('Die iCal-Adresse ist keine gültige Adresse.')
  }
  if (url.protocol !== 'https:' || url.hostname !== 'calendar.google.com') {
    throw new Error('Die iCal-Adresse muss mit https://calendar.google.com/ beginnen.')
  }

  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Der Kalender konnte nicht geladen werden (Fehler ${response.status}).`)
  const text = await response.text()
  // Sicherheitsnetz: bei einer kaputten Antwort nichts löschen
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Die Adresse liefert keinen Kalender.')

  const today = berlinDate(new Date())
  const parsed = parseIcal(text, today)

  const { data: existing, error } = await admin
    .from('events')
    .select('id, calendar_uid, title, due_date, status, deleted_at')
    .eq('user_id', userId)
    .eq('source', 'calendar')
  if (error) throw new Error(error.message)

  const plan = planSync((existing ?? []) as ExistingEvent[], parsed, today)
  const now = new Date().toISOString()

  if (plan.insert.length > 0) {
    const { error: e } = await admin.from('events').insert(
      plan.insert.map((p) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        title: p.title,
        type: 'appointment',
        progress_mode: 'countdown',
        due_date: p.date,
        source: 'calendar',
        calendar_uid: p.uid,
        status: 'active',
        created_at: now,
        updated_at: now,
      })),
    )
    if (e) throw new Error(e.message)
  }

  for (const u of plan.update) {
    const { error: e } = await admin
      .from('events')
      .update({
        title: u.title,
        due_date: u.due_date,
        status: u.status,
        completed_at: u.status === 'done' ? now : null,
        updated_at: now,
      })
      .eq('id', u.id)
    if (e) throw new Error(e.message)
  }

  if (plan.archive.length > 0) {
    const { error: e } = await admin
      .from('events')
      .update({ status: 'done', completed_at: now, updated_at: now })
      .in('id', plan.archive)
    if (e) throw new Error(e.message)
  }

  if (plan.remove.length > 0) {
    const gone = { deleted_at: now, updated_at: now }
    const { error: e1 } = await admin.from('subtasks').update(gone).in('event_id', plan.remove).is('deleted_at', null)
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await admin.from('events').update(gone).in('id', plan.remove)
    if (e2) throw new Error(e2.message)
  }

  return {
    added: plan.insert.length,
    updated: plan.update.length + plan.archive.length,
    removed: plan.remove.length,
    total: parsed.length,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // --- Aufruf durch pg_cron: alle Nutzer -------------------------------
    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret) {
      const { data: ok } = await admin.rpc('check_cron_secret', { candidate: cronSecret })
      if (ok !== true) return json({ error: 'Nicht erlaubt' }, 401)

      const { data: rows, error } = await admin.from('settings').select('user_id, ical_url').not('ical_url', 'is', null)
      if (error) throw new Error(error.message)

      let users = 0
      let failed = 0
      for (const row of rows ?? []) {
        if (!row.ical_url) continue
        try {
          await syncUser(admin, row.user_id, row.ical_url)
          users++
        } catch (e) {
          failed++
          console.error(`sync-calendar ${row.user_id}:`, e instanceof Error ? e.message : e)
        }
      }
      return json({ users, failed })
    }

    // --- Aufruf aus der App: nur der angemeldete Nutzer -------------------
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) return json({ error: 'Nicht angemeldet' }, 401)

    const { data: settings, error } = await admin
      .from('settings')
      .select('ical_url')
      .eq('user_id', auth.user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!settings?.ical_url) return json({ error: 'Es ist noch keine iCal-Adresse gespeichert.' }, 400)

    return json(await syncUser(admin, auth.user.id, settings.ical_url))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('sync-calendar:', message)
    return json({ error: message }, 500)
  }
})
