import { cookies, headers } from 'next/headers'
import AdminLayoutClient from './AdminLayoutClient'
import { resolveServerTheme } from '@/lib/adminTheme'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const requestHeaders = headers()
  const { theme, isManual } = resolveServerTheme(cookieStore, requestHeaders)

  return (
    <AdminLayoutClient initialTheme={theme} initialIsManual={isManual}>
      {children}
    </AdminLayoutClient>
  )
}