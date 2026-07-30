'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { Home, Lock, Star } from 'lucide-react'

interface LoginFormProps {
  onLogin: (password: string) => Promise<{ success: boolean; error?: string }>
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError(t.adminLogin.enterPassword)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await onLogin(password)
      if (!result.success) {
        // 识别网络错误标记并使用对应的国际化消息
        if (result.error === '__NETWORK_ERROR__') {
          setError(t.adminLogin.networkError)
        } else {
          setError(result.error || t.adminLogin.loginFailed)
        }
      }
    } catch (error) {
      setError(t.adminLogin.networkError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="dialogue-box relative p-8 pt-10">
        {/* 名牌 */}
        <div className="name-plate absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 text-sm font-bold tracking-wider uppercase whitespace-nowrap">
          {t.adminLogin.login}
        </div>

        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-primary-strong" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {t.adminLogin.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.adminLogin.description}
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-bold mb-2 text-foreground">
              {t.adminLogin.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder={t.adminLogin.passwordPlaceholder}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="rounded-2xl border-2 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-red-600 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white font-bold py-3 px-4 rounded-full shadow-soft ring-2 ring-white/70 ring-inset transition-all hover:bg-primary-strong disabled:opacity-60"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t.adminLogin.loggingIn}
              </div>
            ) : (
              t.adminLogin.login
            )}
          </button>
        </form>

        {/* 返回首页按钮 */}
        <div className="mt-5">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-card border-2 border-border hover:border-primary text-muted-foreground hover:text-primary-strong transition-colors font-bold text-sm"
          >
            <Home className="w-4 h-4" />
            {t.adminUi.backToHome}
          </Link>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Star className="w-3 h-3 text-secondary" fill="currentColor" />
            {t.adminLogin.forgotPasswordHint}
          </p>
        </div>
      </div>
    </div>
  )
}
