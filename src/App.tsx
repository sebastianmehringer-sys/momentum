import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import { db } from './lib/db'
import { applyTheme } from './lib/theme'
import EventDetailPage from './pages/EventDetail'
import EventsPage from './pages/Events'
import Login from './pages/Login'
import Placeholder from './pages/Placeholder'
import SettingsPage from './pages/Settings'

/** Übernimmt Hell/Dunkel aus den synchronisierten Einstellungen (z. B. vom anderen Gerät). */
function ThemeFromSettings() {
  const theme = useLiveQuery(async () => (await db().settings.get(db().userId))?.theme)
  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])
  return null
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-slate-500">Lädt …</div>
  }
  if (!session) return <Login />

  return (
    <>
      <ThemeFromSettings />
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Placeholder
                emoji="🏠"
                title="Heute"
                text="Hier siehst du bald Fortschrittsringe, heutige Gewohnheiten, fällige Aufgaben und die nächsten Countdowns."
              />
            }
          />
          <Route path="ereignisse" element={<EventsPage />} />
          <Route path="ereignisse/:id" element={<EventDetailPage />} />
          <Route
            path="gewohnheiten"
            element={
              <Placeholder emoji="🔁" title="Gewohnheiten" text="Tägliche und wöchentliche Gewohnheiten mit Streaks." />
            }
          />
          <Route
            path="eingang"
            element={<Placeholder emoji="📥" title="Eingang" text="Lose Aufgaben aus der Schnell-Eingabe." />}
          />
          <Route
            path="erfolge"
            element={<Placeholder emoji="🏆" title="Erfolge" text="Archiv, Statistik und Wochenrückblicke." />}
          />
          <Route path="einstellungen" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}
