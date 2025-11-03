'use client'

import { useState } from 'react'
import { useLocale } from '@/hooks/useLocale'

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
      <div className="transparent-panel rounded-lg shadow-lg p-8">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-500 bg-opacity-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold panel-text">{t.adminLogin.title}</h2>
          <p className="text-gray-600 dark:text-gray-300 panel-text mt-2">
            {t.adminLogin.description}
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium panel-text mb-2">
              {t.adminLogin.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 panel-text"
              placeholder={t.adminLogin.passwordPlaceholder}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

        {/* 提示信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 panel-text">
            {t.adminLogin.forgotPasswordHint}
          </p>
        </div>
      </div>
    </div>
  )
}