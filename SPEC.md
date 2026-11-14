---
erstellt: 2026-11-14
tags: [app, momentum, spezifikation, claude-code]
quelle: Chat mit Claude (grill-me, 11.–14.11.2026)
status: bereit zur Umsetzung
---

# Momentum – Übergabe an Claude Code

Siehe auch: [[Fortschritts-App]] (Entscheidungsprotokoll)

> **Für Claude Code:** Dieses Dokument ist die Spezifikation. Lege es im Repo als `SPEC.md` ab und arbeite die Meilensteine in Reihenfolge ab. Alle Punkte unter „Entscheidungen“ sind mit Sebastian abgestimmt. Punkte unter „Technik-Vorschlag“ darfst du begründet anpassen, sag ihm dann aber kurz Bescheid.

## 1. Über den Nutzer
- Sebastian, Azubi (Technischer Systemplaner), kein Profi-Entwickler
- Windows-PC (PowerShell), Android-Handy (Samsung)
- Erklärungen kurz, auf Deutsch, in Stichpunkten
- Bei jedem Schritt, den er selbst machen muss (Konto anlegen, Klick in einer Web-Oberfläche, „Änderungen zulassen“), genau sagen, was er tun soll

## 2. Ziel der App
- Alle aktuellen Ereignisse/Vorhaben mit Fortschritt auf einen Blick
- Produktivität steigern und motivieren (Heute-Ansicht, Streaks, Erfolge, Push)
- Nur ein Nutzer (Sebastian), Teilen ist später evtl. möglich
- Name: **Momentum**, Sprache der Oberfläche: Deutsch
- Budget: **0 €**, nur Gratis-Tarife

## 3. Entscheidungen (abgestimmt)

### Ereignisse
- Arten: **Vorhaben/Projekt**, **Termin (Countdown)**, **Sparziel**; Gewohnheiten sind ein eigener Bereich (siehe unten)
- Felder: Name, Kategorie, optional Zieldatum, optional Notiz
- Fortschrittsart pro Ereignis wählbar:
  - **Checkliste:** erledigte Unteraufgaben / alle (3/5 = 60 %)
  - **Zahlenwert:** aktuell / Ziel mit Einheit (800 € von 2.000 €)
  - **Zeit:** (heute − Start) / (Ende − Start)
- **Kein** frei einstellbarer Prozentwert

### Kalender
- Quelle: Google-Kalender „Fortschritt“, den Sebastian selbst anlegt
- Zugriff über die **geheime iCal-Adresse** (Einstellungen → Feld zum Einfügen), **kein** Google-OAuth für den Kalender
- Termine daraus werden automatisch zu Ereignissen vom Typ Termin:
  - Anzeige als Countdown („noch 12 Tage“)
  - In der App kann man eine Checkliste ergänzen, dann richtet sich der Fortschritt nach der Checkliste
- Abgleich über die iCal-UID: Titel/Datum werden aktualisiert, die eigene Checkliste bleibt erhalten
- Termine, die im Kalender gelöscht werden, verschwinden auch aus der App. Sind sie vergangen, wandern sie ins Archiv.

### Gewohnheiten
- Häufigkeit: **täglich** oder **X-mal pro Woche** (Tage egal, Woche = Mo–So)
- Streak:
  - täglich: Tage am Stück mit Häkchen; heute noch offen bricht den Streak nicht
  - wöchentlich: Wochen am Stück mit erreichtem Ziel; die laufende Woche bricht den Streak nicht
- Jede Gewohnheit hat eine Kategorie

### Eingang (lose Aufgaben)
- App **ersetzt die Samsung To-Do-App** (kein Sync, Samsung hat keine Schnittstelle)
- Lose Aufgaben aus der Schnell-Eingabe landen im Eingang
- Aufgaben kann man abhaken oder einem Ereignis zuordnen (wird dann Unteraufgabe der Checkliste)
- Optional Fälligkeitsdatum

### Kategorien
- Startliste, frei bearbeitbar (umbenennen, löschen, ergänzen), jede mit eigener Farbe und Emoji:
  - 🎓 Ausbildung & Schule
  - 💪 Gesundheit & Gym
  - 💰 Finanzen
  - ✈️ Reisen
  - 🏠 Privat
- Löschen einer Kategorie mit Einträgen: vorher fragen, wohin die Einträge verschoben werden

### Abgeschlossenes
- Erledigte Ereignisse (Ziel erreicht, Checkliste komplett, Termin vorbei) → **Archiv „Erledigt“** mit Abschlussdatum
- Vergangene Kalendertermine automatisch ins Archiv
- **Erfolgsstatistik:** z. B. erreichte Ziele dieses Jahr, längster Streak, erledigte Aufgaben

### Bereiche / Navigation
| Bereich | Inhalt |
|---|---|
| 🏠 Heute (Startseite) | Fortschrittsringe, heutige Gewohnheiten, fällige Aufgaben, nächste Countdowns |
| 🎯 Ereignisse | alle laufenden Vorhaben, Termine, Sparziele; Filter nach Kategorie |
| 🔁 Gewohnheiten | abhaken, Streaks |
| 📥 Eingang | lose Aufgaben |
| 🏆 Erfolge | Archiv, Statistik, Wochenrückblicke |
| ⚙️ Einstellungen | Kategorien, iCal-Adresse, Benachrichtigungen, Hell/Dunkel |

- Handy: Leiste unten mit den 5 Bereichen, Einstellungen oben rechts
- PC: Seitenleiste links
- ➕ **Schnell-Eingabe** überall sichtbar: Standard = Aufgabe in den Eingang, umschaltbar auf neues Ereignis oder neue Gewohnheit

### Wochenrückblick
- Wird jeden Sonntagabend automatisch erstellt und unter Erfolge gespeichert
- Inhalt: erledigte Aufgaben, Fortschritt pro Ereignis gegenüber der Vorwoche, Gewohnheiten (geschafft/verpasst, Streaks), Liegengebliebenes, nächste Termine

### Push-Benachrichtigungen
| Art | Wann | Bedingung |
|---|---|---|
| Abend-Check | täglich 20:00 (Europe/Berlin) | nur wenn Gewohnheiten offen sind; mit Streak („Noch 1 Gewohnheit offen – Streak: 12 Tage 🔥“) |
| Countdown | 7 Tage und 1 Tag vor einem Termin | mit Checklisten-Stand, falls vorhanden |
| Erfolg | sofort | Ziel erreicht, Streak-Meilenstein 7/30/100 Tage |
| Wochenrückblick | Sonntagabend | „Dein Rückblick ist fertig“ |

- **Höchstens 2 pro Tag.** Reihenfolge bei zu vielen: Erfolg → Countdown 1 Tag → Abend-Check → Countdown 7 Tage → Wochenrückblick
- Jede Art in den Einstellungen einzeln abschaltbar
- Zeitzone immer Europe/Berlin (auch bei Sommer-/Winterzeit)

### Offline
- **Voll offline nutzbar:** ansehen, abhaken, anlegen, bearbeiten
- Änderungen werden lokal gespeichert und automatisch synchronisiert, sobald wieder Netz da ist
- Anzeige des Sync-Status (z. B. kleines Wolken-Symbol)

### Design
- Hell/Dunkel automatisch nach Geräte-Einstellung, manuell umschaltbar
- Fortschritt: **Ringe** in der Heute-Ansicht, **Balken** in Listen
- Schlicht und modern, Kategorien farbig
- Mobil zuerst gestalten, auf dem PC gut nutzbar

### Plattform, Hosting, Login
- **PWA**, installierbar auf Android und Windows
- Daten + Sync: **Supabase** (Free Tier)
- Login: **„Mit Google anmelden“** über Supabase Auth, dauerhaft angemeldet
- Code auf **GitHub** (Sebastian hat ein Konto), Hosting auf **Vercel** (Hobby, automatisch bei jedem Push)
- Entwicklung **lokal auf Sebastians PC** mit Claude Code

## 4. Technik-Vorschlag (darf begründet angepasst werden)
- **Frontend:** Vite + React + TypeScript, Tailwind CSS, React Router
- **PWA:** `vite-plugin-pwa` (Service Worker, Manifest, Icons, Offline-Cache)
- **Offline / local-first:** IndexedDB über **Dexie** als lokale Datenquelle, die UI liest nur lokal
  - Änderungen gehen in eine Outbox-Warteschlange → Sync mit Supabase, sobald online
  - Konflikte: last-write-wins über `updated_at` (ein Nutzer, mehrere Geräte reicht so)
  - Gelöschtes als `deleted_at` (Soft Delete), damit Löschungen synchronisiert werden
- **Backend-Aufgaben in Supabase** (nicht Vercel, weil Vercel-Hobby-Cron stark eingeschränkt ist):
  - **Edge Function `sync-calendar`:** lädt die iCal-Adresse serverseitig (im Browser blockiert CORS) und schreibt Termine in die DB. Läuft per `pg_cron` z. B. stündlich und zusätzlich auf Knopfdruck in der App.
  - **Edge Function `send-push`:** Web Push (VAPID) und die Regeln von oben, per `pg_cron` stündlich. Die Funktion prüft selbst die Berliner Uhrzeit, so stimmen Sommer- und Winterzeit.
  - **Edge Function `weekly-review`:** Sonntagabend den Rückblick erzeugen
- **Sicherheit:**
  - Row Level Security auf allen Tabellen (`user_id = auth.uid()`)
  - iCal-Adresse ist geheim: nur in der DB, nie im Frontend-Code oder Repo
  - Keys in `.env` (in `.gitignore`)
  - `.env.example` ins Repo

### Datenmodell (Vorschlag)
- `categories`: id, user_id, name, emoji, color, sort_order
- `events`: id, user_id, category_id, title, type (`project`|`appointment`|`savings`), progress_mode (`checklist`|`numeric`|`time`|`countdown`), start_date, due_date, current_value, target_value, unit, note, source (`manual`|`calendar`), calendar_uid, status (`active`|`done`|`archived`), completed_at, created_at, updated_at, deleted_at
- `subtasks`: id, event_id, title, done, done_at, sort_order, timestamps
- `habits`: id, user_id, category_id, title, frequency (`daily`|`weekly`), times_per_week, active, timestamps
- `habit_checks`: id, habit_id, date (unique pro Gewohnheit + Tag)
- `inbox_tasks`: id, user_id, title, due_date, done, done_at, timestamps
- `settings`: user_id, ical_url, theme, notify_evening, notify_countdown, notify_achievement, notify_weekly
- `push_subscriptions`: id, user_id, endpoint, keys, device_name
- `notification_log`: id, user_id, kind, ref_id, sent_at (für das Limit von 2 pro Tag und gegen Doppelte)
- `weekly_reviews`: id, user_id, week_start, data (JSON)

## 5. Bau-Reihenfolge (Meilensteine)
Nach jedem Meilenstein: lokal testen, committen, pushen (Vercel deployt), Sebastian kurz zeigen, was neu ist.

0. **Einrichtung**
   - Git für Windows per `winget install --id Git.Git -e` installieren
   - Git-Name und -E-Mail setzen
   - Repo `momentum` auf GitHub anlegen
   - Vite-Projekt erstellen
   - Supabase-Projekt anlegen (Sebastian per Web-Oberfläche, Schritt für Schritt anleiten)
   - Vercel mit dem Repo verbinden
1. **Grundgerüst:** Layout, Navigation (Leiste unten / Seitenleiste), Hell/Dunkel, PWA-Manifest; Google-Login; Datenmodell + RLS; Dexie + Sync-Schicht (**von Anfang an local-first**); Kategorien mit Startliste
2. **Ereignisse:** anlegen/bearbeiten/löschen, drei Fortschrittsarten, Unteraufgaben, Filter, Balken
3. **Gewohnheiten:** täglich/wöchentlich, abhaken, Streak-Berechnung
4. **Eingang + Schnell-Eingabe:** ➕-Button, Aufgaben abhaken, einem Ereignis zuordnen
5. **Heute-Ansicht:** Ringe, heutige Gewohnheiten, fällige Aufgaben, nächste Countdowns
6. **Kalender:** iCal-Feld in den Einstellungen, Edge Function `sync-calendar`, Countdown + optionale Checkliste
7. **Erfolge:** Archiv, Statistik, Wochenrückblick
8. **Push:** VAPID, Abo pro Gerät, Edge Function `send-push`, Einstellungen pro Art, Limit 2/Tag
9. **Feinschliff:** Offline-Tests (Flugmodus), App-Icon, auf Handy und PC installieren, Ladezeiten

## 6. Fertig, wenn …
- App ist auf dem Handy und PC installiert, mit Google-Login
- Änderung am Handy ist kurz darauf am PC sichtbar (und umgekehrt)
- Im Flugmodus kann man abhaken und anlegen; nach dem Wiederverbinden ist alles synchron
- Ein neuer Termin im Kalender „Fortschritt“ erscheint automatisch als Countdown
- Streaks zählen richtig (täglich und Wochenziel)
- Push kommt um 20 Uhr nur bei offenen Gewohnheiten, nie mehr als 2 pro Tag
- Sonntags gibt es einen Wochenrückblick
- Kosten: 0 €

## 7. Später (nicht in Version 1)
- Fokus-Timer (Pomodoro), der Zeit pro Ereignis zählt
- Teilen einzelner Ereignisse mit anderen

## 8. Start-Prompt für Claude Code
> Lies `SPEC.md`. Wir bauen die App „Momentum“. Ich bin kein Profi-Entwickler und arbeite auf Windows (PowerShell). Fang mit Meilenstein 0 an und erklär mir jeden Schritt, den ich selbst machen muss. Arbeite danach die Meilensteine der Reihe nach ab und zeig mir nach jedem, was neu ist.
