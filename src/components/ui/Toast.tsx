'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, CircleX, Info, X } from 'lucide-react'
import { OrnateIcon } from './ornate-icon'

export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  onClose: (id: string) => void
}

export function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const handleClose = useCallback(() => {
    setIsLeaving(true)
    setTimeout(() => {
      onClose(id)
    }, 300) // 等待退出动画完成
  }, [id, onClose])

  useEffect(() => {
    // 进入动画
    const timer = setTimeout(() => setIsVisible(true), 10)

    // 自动关闭
    const autoCloseTimer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => {
      clearTimeout(timer)
      clearTimeout(autoCloseTimer)
    }
  }, [duration, handleClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <OrnateIcon icon={CheckCircle2} tone="mint" size="sm" surface="light" />
      case 'error':
        return <OrnateIcon icon={CircleX} tone="pink" size="sm" surface="light" />
      case 'warning':
        return <OrnateIcon icon={AlertTriangle} tone="amber" size="sm" surface="light" />
      case 'info':
        return <OrnateIcon icon={Info} tone="lavender" size="sm" surface="light" />
    }
  }

  const getColorClasses = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  const getIconColorClasses = () => {
    switch (type) {
      case 'success':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
    }
  }

  return (
    <div
      className={`
        relative max-w-sm w-full
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className={`
        rounded-2xl border-2 p-4 shadow-soft
        ${getColorClasses()}
      `}>
        <div className="flex items-start">
          <div className={`flex-shrink-0 ${getIconColorClasses()}`}>
            {getIcon()}
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium">{title}</h3>
            {message && (
              <p className="mt-1 text-sm opacity-90">{message}</p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className="inline-flex rounded-md p-1.5 hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              <span className="sr-only">关闭</span>
              <OrnateIcon icon={X} tone="pink" size="sm" surface="light" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Toast容器组件
export function ToastContainer({ toasts }: { toasts: ToastProps[] }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed top-0 right-0 z-50 p-4 space-y-4 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} />
        </div>
      ))}
    </div>,
    document.body
  )
}
