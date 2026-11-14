import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { getSyncStatus, subscribeSyncStatus, syncNow, type SyncStatus } from '../lib/sync'

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
}

export function syncLabel(s: SyncStatus) {
  const pending = s.pending > 0 ? ` (${s.pending} ${s.pending === 1 ? 'Änderung wartet' : 'Änderungen warten'})` : ''
  switch (s.state) {
    case 'syncing':
      return 'Synchronisiert …'
    case 'offline':
      return `Offline${pending}`
    case 'error':
      return `Sync-Fehler${pending}`
    default:
      return s.pending > 0 ? `Wartet auf Sync${pending}` : 'Alles synchronisiert'
  }
}

/** Kleines Wolken-Symbol: zeigt den Sync-Status, ein Klick gleicht sofort ab. */
export default function SyncIndicator({ showLabel = false }: { showLabel?: boolean }) {
  const s = useSyncStatus()
  const label = syncLabel(s)

  const icon =
    s.state === 'syncing' ? (
      <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
    ) : s.state === 'offline' ? (
      <CloudOff className="h-5 w-5 text-slate-400" />
    ) : s.state === 'error' ? (
      <CloudAlert className="h-5 w-5 text-red-500" />
    ) : (
      <Cloud className={`h-5 w-5 ${s.pending > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
    )

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={s.error ? `${label}: ${s.error}` : label}
      aria-label={label}
      className="btn btn-ghost px-2"
    >
      {icon}
      {showLabel && <span className="text-xs">{label}</span>}
    </button>
  )
}
