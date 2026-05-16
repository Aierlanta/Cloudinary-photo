import { cookies, headers } from 'next/headers'
import AdminLayoutClient from './AdminLayoutClient'
import { resolveServerTheme } from '@/lib/adminTheme'
import { validateSessionToken } from '@/lib/auth'
import { readAppVersion } from '@/lib/app-version'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const requestHeaders = headers()
  const { theme, isManual } = resolveServerTheme(cookieStore, requestHeaders)
  const sessionToken = cookieStore.get('admin-session')?.value
  const initialIsAuthenticated = sessionToken ? validateSessionToken(sessionToken) : false
  const initialVersion = await readAppVersion()

  return (
    <AdminLayoutClient
      initialTheme={theme}
      initialIsManual={isManual}
      initialIsAuthenticated={initialIsAuthenticated}
      initialVersion={initialVersion}
    >
      {children}
    </AdminLayoutClient>
  )
}