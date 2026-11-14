import type { Theme } from './db'

const KEY = 'momentum-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function storedTheme(): Theme {
  const t = localStorage.getItem(KEY)
  return t === 'light' || t === 'dark' ? t : 'system'
}

/** Setzt Hell/Dunkel sofort und merkt es sich auf diesem Gerät. */
export function applyTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0f172a' : '#4f46e5')
}

// Bei „System“ der Geräte-Einstellung folgen, auch wenn sie sich ändert
media.addEventListener('change', () => applyTheme(storedTheme()))
