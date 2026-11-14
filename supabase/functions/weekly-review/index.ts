// Edge Function "weekly-review"
// Erstellt den Wochenrückblick (Mo–So) und speichert ihn in "weekly_reviews".
//
// Zwei Aufrufarten:
//  - per pg_cron am Sonntagabend (Header x-cron-secret): für alle Nutzer.
//    Der Zeitplan läuft in Weltzeit; die Function prüft selbst, ob es in Berlin
//    Sonntag 19 Uhr ist. So stimmen Sommer- und Winterzeit.
//  - aus der App (Knopf): mit dem Login des Nutzers, sofort für die laufende Woche.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { addDays, berlinDate, berlinHour, weekStart } from '../_shared/core.ts'
import { buildReview, type ReviewData, type ReviewInput } from '../_shared/review.ts'

const REVIEW_HOUR = 19

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

/** Lädt alle Zeilen eines Nutzers (die Schnittstelle liefert höchstens 1000 auf einmal) */
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

async function createReview(admin: SupabaseClient, userId: string, monday: string): Promise<ReviewData> {
  const [events, subtasks, habits, habit_checks, inbox_tasks] = await Promise.all([
    fetchAll<ReviewInput['events'][number]>(
      admin,
      'events',
      'id, title, progress_mode, start_date, due_date, current_value, target_value, status, completed_at, deleted_at',
      userId,
    ),
    fetchAll<ReviewInput['subtasks'][number]>(admin, 'subtasks', 'event_id, title, done, done_at, deleted_at', userId),
    fetchAll<ReviewInput['habits'][number]>(
      admin,
      'habits',
      'id, title, frequency, times_per_week, active, created_at, deleted_at',
      userId,
    ),
    fetchAll<ReviewInput['habit_checks'][number]>(admin, 'habit_checks', 'habit_id, date, deleted_at', userId),
    fetchAll<ReviewInput['inbox_tasks'][number]>(
      admin,
      'inbox_tasks',
      'title, due_date, done, done_at, created_at, deleted_at',
      userId,
    ),
  ])

  const { data: previous, error: previousError } = await admin
    .from('weekly_reviews')
    .select('data')
    .eq('user_id', userId)
    .eq('week_start', addDays(monday, -7))
    .maybeSingle()
  if (previousError) throw new Error(previousError.message)

  const data = buildReview(
    { events, subtasks, habits, habit_checks, inbox_tasks, previous: (previous?.data as ReviewData) ?? null },
    monday,
  )

  const { error } = await admin
    .from('weekly_reviews')
    .upsert({ user_id: userId, week_start: monday, data }, { onConflict: 'user_id,week_start' })
  if (error) throw new Error(error.message)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const now = new Date()
    const today = berlinDate(now)
    const monday = weekStart(today)

    // --- Aufruf durch pg_cron: alle Nutzer -------------------------------
    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret) {
      const { data: ok } = await admin.rpc('check_cron_secret', { candidate: cronSecret })
      if (ok !== true) return json({ error: 'Nicht erlaubt' }, 401)

      const isSunday = addDays(monday, 6) === today
      if (!isSunday || berlinHour(now) !== REVIEW_HOUR) return json({ skipped: 'Nicht Sonntag 19 Uhr (Berlin)' })

      const { data: rows, error } = await admin.from('settings').select('user_id')
      if (error) throw new Error(error.message)

      let users = 0
      let failed = 0
      for (const row of rows ?? []) {
        try {
          await createReview(admin, row.user_id, monday)
          users++
        } catch (e) {
          failed++
          console.error(`weekly-review ${row.user_id}:`, e instanceof Error ? e.message : e)
        }
      }
      return json({ users, failed, week_start: monday })
    }

    // --- Aufruf aus der App: nur der angemeldete Nutzer -------------------
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) return json({ error: 'Nicht angemeldet' }, 401)

    return json(await createReview(admin, auth.user.id, monday))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('weekly-review:', message)
    return json({ error: message }, 500)
  }
})
