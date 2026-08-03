'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import LoginForm from '@/components/admin/LoginForm'
import { LocaleProvider } from '@/hooks/useLocale'
import {
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_COOKIE_MAX_AGE,
  ADMIN_THEME_MODE_COOKIE,
  getClientSystemTheme,
  resolveClientTheme,
  type Theme,
} from '@/lib/adminTheme'
import AdminLayoutV3 from './AdminLayoutV3'
import { SIDEBAR_SUBJECT_CAST_STORAGE_KEY } from './sidebar-mascot'
import { useRecordAdminHistory } from '@/hooks/useAdminHistory'
import { AdminApiProvider, useAdminApi } from '@/lib/admin-api-client'

type AdminLayoutClientProps = {
  children: ReactNode
  initialTheme: Theme
  initialIsManual: boolean
  initialIsAuthenticated: boolean
  initialVersion: string
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

function AdminLayoutContent({
  children,
  initialTheme,
  initialIsManual,
  initialIsAuthenticated,
  initialVersion
}: AdminLayoutClientProps) {
  const router = useRouter()
  const { adminFetch, setAuthToken, clearAuthToken, authToken } = useAdminApi()
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated)
  const [isLoading, setIsLoading] = useState(!initialIsAuthenticated)
  const [panelOpacity, setPanelOpacity] = useState(0.9)
  const [subjectCastEnabled, setSubjectCastEnabled] = useState(false)
  const [subjectCastHydrated, setSubjectCastHydrated] = useState(false)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [isManualTheme, setIsManualTheme] = useState(initialIsManual)

  // 记录访问历史
  useRecordAdminHistory()

  useEffect(() => {
    const preference = resolveClientTheme()

    setTheme(prev => (prev === preference.theme ? prev : preference.theme))
    setIsManualTheme(prev => (prev === preference.isManual ? prev : preference.isManual))
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (initialIsAuthenticated) {
          setIsAuthenticated(true)
          return
        }
        if (!authToken) {
          setIsLoading(false)
          return
        }
        const response = await adminFetch('/api/admin/auth/check')
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
  }, [adminFetch, authToken, initialIsAuthenticated])

  useEffect(() => {
    const savedSubjectCast = localStorage.getItem(SIDEBAR_SUBJECT_CAST_STORAGE_KEY)
    setSubjectCastEnabled(savedSubjectCast === '1' || savedSubjectCast === 'true')
    setSubjectCastHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.style.setProperty('--panel-opacity', panelOpacity.toString())
    localStorage.setItem('admin-panel-opacity', panelOpacity.toString())
  }, [panelOpacity])

  useEffect(() => {
    if (typeof window === 'undefined' || !subjectCastHydrated) {
      return
    }

    localStorage.setItem(SIDEBAR_SUBJECT_CAST_STORAGE_KEY, subjectCastEnabled ? '1' : '0')
  }, [subjectCastEnabled, subjectCastHydrated])

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
      const response = await adminFetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        const data = await response.json()
        // 只保存服务端签发的会话 token；绝不把明文密码写入 localStorage。
        // 没有 token 时依赖登录接口设置的 httpOnly cookie 完成同节点认证。
        if (data.token) {
          setAuthToken(data.token)
        }
        setIsAuthenticated(true)
        return { success: true }
      } else {
        const error = await response.json()
        return { success: false, error: error.message }
      }
    } catch (error) {
      return { success: false, error: '__NETWORK_ERROR__' }
    }
  }

  const handleLogout = async () => {
    try {
      await adminFetch('/api/admin/auth/logout', { method: 'POST' })
      clearAuthToken()
      setIsAuthenticated(false)
      router.push('/admin')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-polka">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <LocaleProvider>
        <div className="min-h-screen bg-polka">
          <div className="min-h-screen flex items-center justify-center p-4">
            <LoginForm onLogin={handleLogin} />
          </div>
        </div>
      </LocaleProvider>
    )
  }

  return (
    <LocaleProvider>
      <AdminLayoutV3
        panelOpacity={panelOpacity}
        setPanelOpacity={setPanelOpacity}
        subjectCastEnabled={subjectCastEnabled}
        setSubjectCastEnabled={setSubjectCastEnabled}
        theme={theme}
        isManualTheme={isManualTheme}
        initialVersion={initialVersion}
        handleThemeToggle={handleThemeToggle}
        handleThemeReset={handleThemeReset}
        handleLogout={handleLogout}
      >
        {children}
      </AdminLayoutV3>
    </LocaleProvider>
  )
}

export default function AdminLayoutClient(props: AdminLayoutClientProps) {
  return (
    <AdminApiProvider>
      <AdminLayoutContent {...props} />
    </AdminApiProvider>
  )
}
