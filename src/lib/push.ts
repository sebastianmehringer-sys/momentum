import { db } from './db'
import { supabase } from './supabase'
import { syncAndWait } from './sync'
import { VAPID_PUBLIC_KEY } from './vapid'

/** Kann dieser Browser überhaupt Push-Benachrichtigungen? */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function deviceName(): string {
  const ua = navigator.userAgent
  const system = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iPhone/iPad'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac/.test(ua)
          ? 'Mac'
          : 'Gerät'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${system} · ${browser}`
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('Benachrichtigungen gehen nur in der veröffentlichten App, nicht in der Entwicklungsansicht.')
  return reg
}

/** Ist auf diesem Gerät ein Push-Abo aktiv? */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return Boolean(reg && (await reg.pushManager.getSubscription()))
}

/** Fragt nach der Erlaubnis und meldet dieses Gerät für Benachrichtigungen an. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('Dieser Browser unterstützt keine Push-Benachrichtigungen.')
  if (!navigator.onLine) throw new Error('Dafür brauchst du eine Internetverbindung.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen.')
  }

  const reg = await registration()
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))

  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: db().userId, endpoint, keys, device_name: deviceName() }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

/** Meldet dieses Gerät wieder ab. */
export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/** Schickt sofort eine Test-Benachrichtigung an alle angemeldeten Geräte. */
export async function sendTestPush(): Promise<{ devices: number; delivered: number }> {
  const { data, error } = await supabase.functions.invoke('send-push', { body: { mode: 'test' } })
  if (error) {
    let message = 'Die Test-Benachrichtigung konnte nicht gesendet werden.'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) message = body.error
    } catch {
      /* keine lesbare Antwort */
    }
    throw new Error(message)
  }
  return data
}

let achievementTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Nach einem möglichen Erfolg (Ziel erreicht, Gewohnheit abgehakt): den Server kurz
 * prüfen lassen, ob eine Erfolgs-Benachrichtigung fällig ist. Klappt das gerade nicht
 * (z. B. offline), holt es der stündliche Lauf nach.
 */
export function requestAchievementCheck() {
  clearTimeout(achievementTimer)
  achievementTimer = setTimeout(() => {
    void (async () => {
      try {
        if (!navigator.onLine) return
        await syncAndWait()
        await supabase.functions.invoke('send-push', { body: { mode: 'achievements' } })
      } catch {
        /* nicht schlimm, der stündliche Lauf holt es nach */
      }
    })()
  }, 3000)
}
