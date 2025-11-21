'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to get current theme state and listen for changes
 * Returns true if light mode, false if dark mode
 */
export function useTheme() {
  const [isLight, setIsLight] = useState(() => {
    if (typeof window === 'undefined') return true
    return !document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initial check
    setIsLight(!document.documentElement.classList.contains('dark'))

    // Watch for class changes on documentElement
    const observer = new MutationObserver(() => {
      setIsLight(!document.documentElement.classList.contains('dark'))
    })

    // Observe class changes on documentElement
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Also listen for storage events (in case theme changes in another tab)
    const handleStorageChange = () => {
      setIsLight(!document.documentElement.classList.contains('dark'))
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return isLight
}

