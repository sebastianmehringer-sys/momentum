// Edge Function "send-push"
// Verschickt Web-Push-Benachrichtigungen (VAPID) nach den Regeln in _shared/notify.ts.
//
// Aufrufarten:
//  - stündlich per pg_cron (Header x-cron-secret): prüft für alle Nutzer, was fällig ist.
//    Die Function schaut selbst auf die Berliner Uhrzeit (Sommer-/Winterzeit).
//  - aus der App mit dem Login des Nutzers:
//      { "mode": "test" }          sofort eine Test-Benachrichtigung an die eigenen Geräte
//      { "mode": "achievements" }  sofort prüfen, ob ein Erfolg zu melden ist

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { berlinHour, weekStart } from '../_shared/core.ts'
import {
  buildCandidates,
  makeClock,
  selectToSend,
  type Candidate,
  type Clock,
  type NotifyInput,
} from '../_shared/notify.ts'

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

interface Subscription {
  id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

async function fetchAll<T>(admin: SupabaseClient, table: string, columns: string, userId: string): Promise<T[]> {
  const rows: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < page) return rows
  }
}

/** Schickt eine Benachrichtigung an alle Geräte. Gibt zurück, auf wie vielen sie ankam. */
async function deliver(admin: SupabaseClient, subscriptions: Subscription[], c: Candidate): Promise<number> {
  const payload = JSON.stringify({ title: c.title, body: c.body, url: c.url, tag: `${c.kind}:${c.ref}` })
  let delivered = 0
  for (const s of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 6 * 3600 })
      delivered++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // Das Gerät hat das Abo beendet: aufräumen
        await admin.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        console.error('send-push Zustellung:', status, e instanceof Error ? e.message : e)
      }
    }
  }
  return delivered
}

async function subscriptionsOf(admin: SupabaseClient, userId: string): Promise<Subscription[]> {
  const { data, error } = await admin.from('push_subscriptions').select('id, endpoint, keys').eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []) as Subscription[]
}

/** Prüft für einen Nutzer, was fällig ist, und verschickt es. */
async function processUser(
  admin: SupabaseClient,
  userId: string,
  clock: Clock,
  onlyAchievements: boolean,
): Promise<number> {
  const subscriptions = await subscriptionsOf(admin, userId)
  if (subscriptions.length === 0) return 0

  const { data: settings, error: settingsError } = await admin
    .from('settings')
    .select('notify_evening, notify_countdown, notify_achievement, notify_weekly')
    .eq('user_id', userId)
    .maybeSingle()
  if (settingsError) throw new Error(settingsError.message)
  if (!settings) return 0

  const [events, subtasks, habits, habit_checks] = await Promise.all([
    fetchAll<NotifyInput['events'][number]>(
      admin,
      'events',
      'id, title, type, progress_mode, due_date, status, completed_at, deleted_at',
      userId,
    ),
    fetchAll<NotifyInput['subtasks'][number]>(admin, 'subtasks', 'event_id, done, deleted_at', userId),
    fetchAll<NotifyInput['habits'][number]>(
      admin,
      'habits',
      'id, title, frequency, times_per_week, active, deleted_at',
      userId,
    ),
    fetchAll<NotifyInput['habit_checks'][number]>(admin, 'habit_checks', 'habit_id, date, deleted_at', userId),
  ])

  const { count: reviewCount, error: reviewError } = await admin
    .from('weekly_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('week_start', clock.monday)
  if (reviewError) throw new Error(reviewError.message)

  const input: NotifyInput = {
    settings,
    events,
    subtasks,
    habits,
    habit_checks,
    hasReviewThisWeek: (reviewCount ?? 0) > 0,
  }

  let candidates = buildCandidates(input, clock)
  if (onlyAchievements) candidates = candidates.filter((c) => c.kind === 'achievement')
  if (candidates.length === 0) return 0

  // Protokoll der letzten Tage: gegen Doppelte und für das Limit von 2 pro Tag
  const since = new Date(clock.now.getTime() - 8 * 24 * 3_600_000).toISOString()
  const { data: log, error: logError } = await admin
    .from('notification_log')
    .select('kind, ref_id, sent_at')
    .eq('user_id', userId)
    .gte('sent_at', since)
  if (logError) throw new Error(logError.message)

  const alreadySent = new Set((log ?? []).map((l) => `${l.kind}|${l.ref_id}`))
  const berlinDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
  const sentToday = (log ?? []).filter((l) => berlinDay(l.sent_at) === clock.today).length

  let sent = 0
  for (const c of selectToSend(candidates, alreadySent, sentToday, input, clock)) {
    // Erst protokollieren, dann senden: lieber eine verpasste als eine doppelte Benachrichtigung
    const { error } = await admin.from('notification_log').insert({ user_id: userId, kind: c.kind, ref_id: c.ref })
    if (error) throw new Error(error.message)
    await deliver(admin, subscriptions, c)
    sent++
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const subject = Deno.env.get('VAPID_SUBJECT')
    if (!publicKey || !privateKey || !subject) throw new Error('Die VAPID-Schlüssel sind nicht eingerichtet.')
    webpush.setVapidDetails(subject, publicKey, privateKey)

    const clock = makeClock(new Date(), berlinHour, weekStart)

    // --- Aufruf durch pg_cron: alle Nutzer -------------------------------
    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret) {
      const { data: ok } = await admin.rpc('check_cron_secret', { candidate: cronSecret })
      if (ok !== true) return json({ error: 'Nicht erlaubt' }, 401)

      const { data: rows, error } = await admin.from('settings').select('user_id')
      if (error) throw new Error(error.message)

      let sent = 0
      let failed = 0
      for (const row of rows ?? []) {
        try {
          sent += await processUser(admin, row.user_id, clock, false)
        } catch (e) {
          failed++
          console.error(`send-push ${row.user_id}:`, e instanceof Error ? e.message : e)
        }
      }
      return json({ sent, failed, hour: clock.hour })
    }

    // --- Aufruf aus der App: nur der angemeldete Nutzer -------------------
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) return json({ error: 'Nicht angemeldet' }, 401)

    const body = await req.json().catch(() => ({}))

    if (body?.mode === 'test') {
      const subscriptions = await subscriptionsOf(admin, auth.user.id)
      if (subscriptions.length === 0) return json({ error: 'Auf keinem Gerät sind Benachrichtigungen aktiviert.' }, 400)
      const delivered = await deliver(admin, subscriptions, {
        kind: 'achievement',
        ref: `test:${Date.now()}`,
        title: 'Momentum',
        body: 'Die Benachrichtigungen funktionieren 🎉',
        url: '/',
      })
      return json({ devices: subscriptions.length, delivered })
    }

    if (body?.mode === 'achievements') {
      return json({ sent: await processUser(admin, auth.user.id, clock, true) })
    }

    return json({ error: 'Unbekannter Aufruf' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('send-push:', message)
    return json({ error: message }, 500)
  }
})
