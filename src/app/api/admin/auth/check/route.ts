import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('admin-session')

    if (!sessionToken) {
      return NextResponse.json(
        { message: '未登录' },
        { status: 401 }
      )
    }

    // 简单验证session存在即可
    return NextResponse.json({ message: '已登录' })
  } catch (error) {
    console.error('认证检查错误:', error)
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    )
  }
}