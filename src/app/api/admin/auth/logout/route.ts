import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const cookieStore = cookies()
    cookieStore.delete('admin-session')

    return NextResponse.json({ message: '登出成功' })
  } catch (error) {
    console.error('登出错误:', error)
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    )
  }
}