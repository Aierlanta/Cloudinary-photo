'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const isProduction = process.env.NODE_ENV === 'production'
    
    // 仅在生产环境启用 PostHog（本地开发时跳过，避免网络问题）
    if (posthogKey && isProduction && typeof window !== 'undefined') {
      posthog.init(posthogKey, {
        api_host: '/ingest',
        ui_host: 'https://us.i.posthog.com',
        defaults: '2025-11-30',
        capture_pageview: true,
        capture_pageleave: true,
      })
    }
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
