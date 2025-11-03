export type Theme = 'light' | 'dark'

export const ADMIN_THEME_COOKIE = 'admin-theme'
export const ADMIN_THEME_MODE_COOKIE = 'admin-theme-mode'
export const ADMIN_THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export const SITE_THEME_COOKIE = 'site-theme'
export const SITE_THEME_MODE_COOKIE = 'site-theme-mode'
export const SITE_THEME_COOKIE_MAX_AGE = 60 * 30 // 30 minutes

export type ThemePreference = {
  theme: Theme
  isManual: boolean
}

const setClientCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

const deleteClientCookie = (name: string) => {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

const isValidTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

const escapeCookieName = (name: string) => name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')

const readClientCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${escapeCookieName(name)}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

type CookieStore = {
  get(name: string): { value: string } | undefined
}

type HeaderStore = {
  get(name: string): string | null
}

export const resolveServerTheme = (cookieStore: CookieStore, requestHeaders: HeaderStore): ThemePreference => {
  const mode = cookieStore.get(ADMIN_THEME_MODE_COOKIE)?.value
  const storedTheme = cookieStore.get(ADMIN_THEME_COOKIE)?.value

  if (mode === 'manual' && isValidTheme(storedTheme)) {
    return { theme: storedTheme, isManual: true }
  }

  const prefersDark = requestHeaders.get('sec-ch-prefers-color-scheme') === 'dark'

  return {
    theme: prefersDark ? 'dark' : 'light',
    isManual: false,
  }
}

export const getClientSystemTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  if (typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const resolveClientTheme = (): ThemePreference => {
  const mode = readClientCookie(ADMIN_THEME_MODE_COOKIE)
  const storedTheme = readClientCookie(ADMIN_THEME_COOKIE)

  if (mode === 'manual' && isValidTheme(storedTheme)) {
    return { theme: storedTheme, isManual: true }
  }

  return { theme: getClientSystemTheme(), isManual: false }
}

export const resolveClientThemeFor = (themeCookieName: string, modeCookieName: string): ThemePreference => {
  const mode = readClientCookie(modeCookieName)
  const storedTheme = readClientCookie(themeCookieName)

  if (mode === 'manual' && isValidTheme(storedTheme)) {
    return { theme: storedTheme, isManual: true }
  }

  return { theme: getClientSystemTheme(), isManual: false }
}

export const resolveSiteClientTheme = (): ThemePreference =>
  resolveClientThemeFor(SITE_THEME_COOKIE, SITE_THEME_MODE_COOKIE)

export const applyThemeToRoot = (theme: Theme) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export const setSiteManualTheme = (theme: Theme, maxAgeSeconds = SITE_THEME_COOKIE_MAX_AGE) => {
  setClientCookie(SITE_THEME_COOKIE, theme, maxAgeSeconds)
  setClientCookie(SITE_THEME_MODE_COOKIE, 'manual', maxAgeSeconds)
}

export const clearSiteManualTheme = (maxAgeSeconds = SITE_THEME_COOKIE_MAX_AGE) => {
  deleteClientCookie(SITE_THEME_COOKIE)
  setClientCookie(SITE_THEME_MODE_COOKIE, 'system', maxAgeSeconds)
}
