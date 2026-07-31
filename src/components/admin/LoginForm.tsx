'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/hooks/useLocale'
import { AlertTriangle, Home, LoaderCircle, Lock, Star } from 'lucide-react'
import { OrnateIcon } from '@/components/ui/ornate-icon'
import styles from './login-form.module.css'

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
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.namePlate}>
          {t.adminLogin.login}
        </div>

        <div className={styles.heading}>
          <OrnateIcon
            icon={Lock}
            tone="pink"
            size="xl"
            className={styles.crest}
          />
          <h2>
            {t.adminLogin.title}
          </h2>
          <p>
            {t.adminLogin.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="password">
              {t.adminLogin.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder={t.adminLogin.passwordPlaceholder}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <OrnateIcon icon={AlertTriangle} tone="pink" size="sm" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={styles.submit}
          >
            {isLoading ? (
              <span className={styles.loading}>
                <OrnateIcon icon={LoaderCircle} tone="cream" size="sm" className="animate-spin" />
                {t.adminLogin.loggingIn}
              </span>
            ) : (
              t.adminLogin.login
            )}
          </button>
        </form>

        <Link href="/" className={styles.backLink}>
          <OrnateIcon icon={Home} tone="lavender" size="sm" />
          {t.adminUi.backToHome}
        </Link>

        <p className={styles.hint}>
          <OrnateIcon icon={Star} tone="amber" size="sm" />
          {t.adminLogin.forgotPasswordHint}
        </p>
      </div>
    </div>
  )
}
