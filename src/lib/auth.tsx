import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { openDb } from './db'
import { supabase } from './supabase'
import { startSync } from './sync'

interface AuthValue {
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) openDb(data.session.user.id)
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) openDb(next.user.id)
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  // Nach der Anmeldung: Startdaten sicherstellen und Sync starten
  useEffect(() => {
    if (!userId) return
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
  }, [userId])

  const value: AuthValue = {
    session,
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
