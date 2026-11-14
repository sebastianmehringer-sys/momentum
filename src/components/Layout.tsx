import { House, Inbox, Repeat, Settings, Target, Trophy, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import QuickAdd from './QuickAdd'
import SyncIndicator from './SyncIndicator'

const AREAS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Heute', icon: House },
  { to: '/ereignisse', label: 'Ereignisse', icon: Target },
  { to: '/gewohnheiten', label: 'Gewohnheiten', icon: Repeat },
  { to: '/eingang', label: 'Eingang', icon: Inbox },
  { to: '/erfolge', label: 'Erfolge', icon: Trophy },
]

const active = 'text-indigo-600 dark:text-indigo-400'
const inactive = 'text-slate-500 dark:text-slate-400'

export default function Layout() {
  const { pathname } = useLocation()
  const title =
    pathname === '/einstellungen' ? 'Einstellungen' : (AREAS.find((a) => (a.to === '/' ? pathname === '/' : pathname.startsWith(a.to)))?.label ?? 'Momentum')

  return (
    <div className="md:flex">
      {/* PC: Seitenleiste links */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-bold">Momentum</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {AREAS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                  isActive
                    ? `bg-indigo-50 dark:bg-indigo-500/10 ${active}`
                    : `hover:bg-slate-100 dark:hover:bg-slate-800 ${inactive}`
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <SyncIndicator showLabel />
        <NavLink
          to="/einstellungen"
          className={({ isActive }) =>
            `mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
              isActive
                ? `bg-indigo-50 dark:bg-indigo-500/10 ${active}`
                : `hover:bg-slate-100 dark:hover:bg-slate-800 ${inactive}`
            }`
          }
        >
          <Settings className="h-5 w-5" />
          Einstellungen
        </NavLink>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Handy: Kopfzeile mit Sync-Status und Einstellungen oben rechts */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <h1 className="text-lg font-bold">{title}</h1>
          <div className="flex items-center">
            <SyncIndicator />
            <NavLink
              to="/einstellungen"
              aria-label="Einstellungen"
              className={({ isActive }) => `btn btn-ghost px-2 ${isActive ? active : ''}`}
            >
              <Settings className="h-5 w-5" />
            </NavLink>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
          <h1 className="mb-4 hidden text-2xl font-bold md:block">{title}</h1>
          <Outlet />
        </main>
      </div>

      <QuickAdd />

      {/* Handy: Leiste unten mit den 5 Bereichen */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        {AREAS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? active : inactive}`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
