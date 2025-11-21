'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { Home } from 'lucide-react'

interface LoginFormProps {
  onLogin: (password: string) => Promise<{ success: boolean; error?: string }>
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const { t, locale } = useLocale()
  const isLight = useTheme()
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
      <div className={cn(
        "border rounded-lg p-8",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className={cn(
            "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
            isLight ? "bg-blue-500 bg-opacity-20" : "bg-blue-600 bg-opacity-20"
          )}>
            <svg className={cn(
              "w-8 h-8",
              isLight ? "text-blue-600" : "text-blue-400"
            )} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className={cn(
            "text-2xl font-bold",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>{t.adminLogin.title}</h2>
          <p className={cn(
            "mt-2",
            isLight ? "text-gray-600" : "text-gray-400"
          )}>
            {t.adminLogin.description}
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className={cn(
              "block text-sm font-medium mb-2",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminLogin.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                isLight
                  ? "bg-white border-gray-300 text-gray-900"
                  : "bg-gray-800 border-gray-600 text-gray-100"
              )}
              placeholder={t.adminLogin.passwordPlaceholder}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={cn(
              "border rounded-lg p-3",
              isLight
                ? "bg-red-50 border-red-200"
                : "bg-red-900 bg-opacity-20 border-red-800"
            )}>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={cn(
                  "text-sm",
                  isLight ? "text-red-700" : "text-red-300"
                )}>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border",
              isLight
                ? "bg-blue-500 border-blue-600 hover:bg-blue-600 disabled:bg-blue-400"
                : "bg-blue-600 border-blue-500 hover:bg-blue-700 disabled:bg-blue-500"
            )}
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
        <div className="mt-6">
          <Link
            href="/"
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-colors border",
              isLight
                ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
            )}
          >
            <Home className="w-4 h-4" />
            {locale === 'zh' ? '返回首页' : 'Back to Home'}
          </Link>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 text-center">
          <p className={cn(
            "text-xs",
            isLight ? "text-gray-500" : "text-gray-400"
          )}>
            {t.adminLogin.forgotPasswordHint}
          </p>
        </div>
      </div>
    </div>
  )
}