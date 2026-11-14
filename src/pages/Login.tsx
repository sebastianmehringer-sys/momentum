import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function login() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="card w-full max-w-sm p-8 text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-2xl font-bold">Momentum</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Alle Vorhaben und ihr Fortschritt auf einen Blick
        </p>

        {supabaseConfigured ? (
          <button className="btn btn-primary mt-8 w-full py-3" onClick={login} disabled={busy}>
            Mit Google anmelden
          </button>
        ) : (
          <p className="mt-8 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">
            Die Verbindung zu Supabase ist nicht eingerichtet (Datei <code>.env</code> fehlt oder ist unvollständig).
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
