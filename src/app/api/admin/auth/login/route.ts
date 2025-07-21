import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json(
        { message: '密码不能为空' },
        { status: 400 }
      )
    }

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json(
        { message: '服务器配置错误：未设置管理员密码' },
        { status: 500 }
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { message: '密码错误' },
        { status: 401 }
      )
    }

    // 创建简单的会话token
    const sessionToken = createHash('sha256')
      .update(`${adminPassword}-${Date.now()}`)
      .digest('hex')

    // 设置cookie
    const cookieStore = cookies()
    cookieStore.set('admin-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24小时
    })

    return NextResponse.json({ message: '登录成功' })
  } catch (error) {
    console.error('登录错误:', error)
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    )
  }
}