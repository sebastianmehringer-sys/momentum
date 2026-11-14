# Momentum

Alle Vorhaben, Termine, Sparziele und Gewohnheiten mit Fortschritt auf einen Blick.
Installierbare Web-App (PWA) für Handy und PC, voll offline nutzbar.

- **App:** https://momentum-dun-one.vercel.app
- **Spezifikation:** [SPEC.md](SPEC.md)

## Aufbau

| Teil | Technik | Ort |
|---|---|---|
| Oberfläche | Vite, React, TypeScript, Tailwind CSS | `src/` |
| Lokale Daten (offline) | IndexedDB über Dexie | `src/lib/db.ts` |
| Abgleich mit dem Server | Outbox + „last write wins“ | `src/lib/sync.ts` |
| Datenbank, Login | Supabase (Postgres, Google-Login) | `supabase/migrations/` |
| Server-Aufgaben | Supabase Edge Functions | `supabase/functions/` |
| Hosting | Vercel (automatisch bei jedem Push auf `main`) | |

Die Rechenregeln für Fortschritt, Streaks, Wochenrückblick und Benachrichtigungen liegen in
`supabase/functions/_shared/` und werden von App **und** Server benutzt.

### Edge Functions

| Function | Aufgabe | Zeitplan (pg_cron) |
|---|---|---|
| `sync-calendar` | Google-Kalender „Fortschritt“ über die geheime iCal-Adresse abgleichen | stündlich um :05 |
| `weekly-review` | Wochenrückblick erstellen | Sonntag 18:50 Uhr (Berlin) |
| `send-push` | Push-Benachrichtigungen (höchstens 2 pro Tag) | stündlich um :00 |

## Befehle (PowerShell, im Projektordner)

```powershell
npm.cmd install        # Pakete installieren (einmalig bzw. nach Änderungen)
npm.cmd run dev        # Entwicklungsansicht auf http://localhost:5173
npm.cmd test           # automatische Tests
npm.cmd run build      # Produktions-Build (prüft auch die Typen)
```

Hinweis: Auf diesem PC blockiert Windows `npm`/`npx` in PowerShell. Mit `.cmd` am Ende
(`npm.cmd`, `npx.cmd`) funktioniert es.

### Veröffentlichen

- **App:** `git push` genügt, Vercel baut und veröffentlicht automatisch.
- **Edge Function** (nach Änderungen unter `supabase/functions/`):

  ```powershell
  npx.cmd supabase functions deploy sync-calendar --remote=ipkslnklfbigfxmajazo --no-verify-jwt --use-api
  ```

- **Datenbank-Skripte** unter `supabase/migrations/` der Reihe nach im Supabase SQL Editor ausführen.
  Alle Skripte können gefahrlos erneut ausgeführt werden.

## Geheimnisse

- `.env` (nicht im Repo): `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`, Vorlage in `.env.example`.
  Dieselben zwei Werte stehen bei Vercel unter *Environment Variables*.
- Bei Supabase als Function-Geheimnis: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- Die iCal-Adresse steht nur in der Datenbank (Tabelle `settings`), nie im Code.
- Das Geheimnis für die Zeitpläne wird in der Datenbank erzeugt (`private.config`) und verlässt sie nicht.
