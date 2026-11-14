import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { openDb } from './db'
import { supabase } from './supabase'
import { startSync } from './sync'

interface KnownUser {
  id: string
  email: string
}

interface AuthValue {
  /** Der Nutzer dieses Geräts. Auch offline bekannt, sobald er sich einmal angemeldet hat. */
  user: KnownUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// Wer zuletzt angemeldet war. Damit lässt sich die App auch dann offline öffnen,
// wenn die Anmeldung gerade nicht erneuert werden kann (z. B. im Flugmodus).
const LAST_USER = 'momentum-last-user'

function readLastUser(): KnownUser | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_USER) ?? 'null')
    return value && typeof value.id === 'string' ? value : null
  } catch {
    return null
  }
}

function toKnownUser(session: Session): KnownUser {
  return { id: session.user.id, email: session.user.email ?? '' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<KnownUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const signedIn = (next: Session) => {
      const known = toKnownUser(next)
      localStorage.setItem(LAST_USER, JSON.stringify(known))
      openDb(known.id)
      setUser(known)
      setSession(next)
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      const last = readLastUser()
      if (data.session) {
        signedIn(data.session)
      } else if (last && (error || !navigator.onLine)) {
        // Anmeldung konnte nicht erneuert werden (kein Netz): mit den lokalen Daten weiterarbeiten.
        // Synchronisiert wird, sobald die Anmeldung wieder steht.
        openDb(last.id)
        setUser(last)
      }
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (next) {
        signedIn(next)
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem(LAST_USER)
        setUser(null)
        setSession(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const sessionUserId = session?.user.id

  // Sobald eine gültige Anmeldung da ist: Startdaten sicherstellen und Sync starten
  useEffect(() => {
    if (!sessionUserId) return
    let stop: (() => void) | undefined
    let cancelled = false
    void (async () => {
      if (navigator.onLine) {
        const { error } = await supabase.rpc('init_user')
        if (error) console.error('init_user fehlgeschlagen:', error.message)
      }
      if (!cancelled) stop = startSync()
    })()
    return () => {
      cancelled = true
      stop?.()
    }
  }, [sessionUserId])

  const value: AuthValue = {
    user,
    loading,
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth außerhalb von AuthProvider')
  return value
}
