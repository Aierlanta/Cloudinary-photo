'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import AdminNavigation from '@/components/admin/AdminNavigation'
import LoginForm from '@/components/admin/LoginForm'
import TransparencyControl from '@/components/admin/TransparencyControl'
import { ComponentErrorBoundary } from '@/components/ErrorBoundary'
import {
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_COOKIE_MAX_AGE,
  ADMIN_THEME_MODE_COOKIE,
  getClientSystemTheme,
  resolveClientTheme,
  type Theme,
} from '@/lib/adminTheme'

type AdminLayoutClientProps = {
  children: ReactNode
  initialTheme: Theme
  initialIsManual: boolean
}

const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

export default function AdminLayoutClient({ children, initialTheme, initialIsManual }: AdminLayoutClientProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [panelOpacity, setPanelOpacity] = useState(0.9)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [isManualTheme, setIsManualTheme] = useState(initialIsManual)

  useEffect(() => {
    const preference = resolveClientTheme()

    setTheme(prev => (prev === preference.theme ? prev : preference.theme))
    setIsManualTheme(prev => (prev === preference.isManual ? prev : preference.isManual))
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth/check')
        if (response.ok) {
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error('认证检查失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    const savedOpacity = localStorage.getItem('admin-panel-opacity')
    if (savedOpacity) {
      setPanelOpacity(parseFloat(savedOpacity))
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.style.setProperty('--panel-opacity', panelOpacity.toString())
    localStorage.setItem('admin-panel-opacity', panelOpacity.toString())
  }, [panelOpacity])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    root.dataset.theme = theme

    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    if (isManualTheme) {
      setCookie(ADMIN_THEME_COOKIE, theme, ADMIN_THEME_COOKIE_MAX_AGE)
      setCookie(ADMIN_THEME_MODE_COOKIE, 'manual', ADMIN_THEME_COOKIE_MAX_AGE)
    } else {
      deleteCookie(ADMIN_THEME_COOKIE)
      setCookie(ADMIN_THEME_MODE_COOKIE, 'system', ADMIN_THEME_COOKIE_MAX_AGE)
    }
  }, [theme, isManualTheme])

  useEffect(() => {
    if (typeof window === 'undefined' || isManualTheme) {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applySystemTheme = (matches: boolean) => {
      setTheme(prev => {
        const nextTheme: Theme = matches ? 'dark' : 'light'
        return prev === nextTheme ? prev : nextTheme
      })
    }

    applySystemTheme(media.matches)

    const listener = (event: MediaQueryListEvent) => applySystemTheme(event.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }

    media.addListener(listener)
    return () => media.removeListener(listener)
  }, [isManualTheme])

  const handleThemeToggle = () => {
    setIsManualTheme(true)
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  const handleThemeReset = () => {
    setIsManualTheme(false)
    setTheme(getClientSystemTheme())
  }

  const handleLogin = async (password: string) => {
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setIsAuthenticated(true)
        return { success: true }
      } else {
        const error = await response.json()
        return { success: false, error: error.message || '登录失败' }
      }
    } catch (error) {
      return { success: false, error: '网络错误' }
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
      setIsAuthenticated(false)
      router.push('/admin')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="min-h-screen flex items-center justify-center p-4">
          <LoginForm onLogin={handleLogin} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <TransparencyControl
        opacity={panelOpacity}
        onChange={setPanelOpacity}
        theme={theme}
        isManualTheme={isManualTheme}
        onThemeToggle={handleThemeToggle}
        onThemeReset={handleThemeReset}
      />

      <div className="flex">
        <AdminNavigation onLogout={handleLogout} onToggleCollapse={setSidebarCollapsed} />

        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
          <div className="p-6">
            <ComponentErrorBoundary componentName="AdminPage">
              {children}
            </ComponentErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
