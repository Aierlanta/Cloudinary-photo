import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { validateSessionToken } from '@/lib/auth'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('admin-session')

    if (!sessionToken || !validateSessionToken(sessionToken.value)) {
      return NextResponse.json(
        { message: '未登录' },
        { status: 401 }
      )
    }

    // 会话令牌有效
    return NextResponse.json({ message: '已登录' })
  } catch (error) {
    console.error('认证检查错误:', error)
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    )
  }
}