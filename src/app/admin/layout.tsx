'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminNavigation from '@/components/admin/AdminNavigation'
import LoginForm from '@/components/admin/LoginForm'
import TransparencyControl from '@/components/admin/TransparencyControl'
import { ComponentErrorBoundary } from '@/components/ErrorBoundary'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [panelOpacity, setPanelOpacity] = useState(0.9)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 检查认证状态
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

    // 从localStorage恢复透明度设置
    const savedOpacity = localStorage.getItem('admin-panel-opacity')
    if (savedOpacity) {
      setPanelOpacity(parseFloat(savedOpacity))
    }
  }, [])

  useEffect(() => {
    // 更新CSS变量
    document.documentElement.style.setProperty('--panel-opacity', panelOpacity.toString())
    // 保存到localStorage
    localStorage.setItem('admin-panel-opacity', panelOpacity.toString())
  }, [panelOpacity])

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
      {/* 透明度控制器 */}
      <TransparencyControl
        opacity={panelOpacity}
        onChange={setPanelOpacity}
      />
      
      {/* 主要布局 */}
      <div className="flex">
        {/* 侧边导航 */}
        <AdminNavigation onLogout={handleLogout} onToggleCollapse={setSidebarCollapsed} />

        {/* 主内容区域 */}
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