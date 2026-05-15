import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSessionToken, verifyAdminAuth } from '@/lib/auth'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (request && 'cookies' in request && 'nextUrl' in request) {
      verifyAdminAuth(request as NextRequest)
    } else {
      const cookieStore = cookies()
      const sessionToken = cookieStore.get('admin-session')
      if (!sessionToken || !validateSessionToken(sessionToken.value)) {
        return NextResponse.json({ message: '未登录' }, { status: 401 })
      }
    }
    return NextResponse.json({ message: '已登录' })
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode === 401 ? 401 : 500
    if (status === 401) {
      return NextResponse.json({ message: '未登录' }, { status })
    }
    console.error('认证检查错误:', error)
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status }
    )
  }
}