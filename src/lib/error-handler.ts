/**
 * 统一错误处理中间件
 * 处理API错误、记录日志、返回标准化响应
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'
import { AppError, ErrorType } from '@/types/errors'
import { APIResponse } from '@/types/api'

export interface ErrorContext {
  requestId?: string
  userId?: string
  endpoint?: string
  method?: string
  userAgent?: string
  ip?: string
}

/**
 * API错误处理中间件
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    const startTime = performance.now()
    let request: NextRequest | undefined
    let requestId: string | undefined

    try {
      // 尝试从参数中提取请求对象
      request = args.find(arg => arg instanceof NextRequest) as NextRequest
      requestId = generateRequestId()

      // 记录请求开始
      if (request) {
        logger.apiRequest(request.method, new URL(request.url).pathname, {
          requestId,
          userAgent: request.headers.get('user-agent'),
          ip: getClientIP(request)
        })
      }

      // 执行处理函数
      const response = await handler(...args)
      
      // 记录成功响应
      const duration = Math.round(performance.now() - startTime)
      if (request) {
        logger.apiResponse(
          request.method,
          new URL(request.url).pathname,
          response.status,
          duration,
          { requestId }
        )
      }

      return response

    } catch (error) {
      const duration = Math.round(performance.now() - startTime)
      
      // 创建错误上下文
      const context: ErrorContext = {
        requestId,
        endpoint: request ? new URL(request.url).pathname : 'unknown',
        method: request?.method,
        userAgent: request?.headers.get('user-agent') || undefined,
        ip: request ? getClientIP(request) : undefined
      }

      // 处理错误并返回响应
      return handleError(error, context, duration)
    }
  }
}

/**
 * 处理错误并返回标准化响应
 */
export function handleError(
  error: unknown,
  context: ErrorContext = {},
  duration?: number
): Response {
  let appError: AppError
  let statusCode: number

  // 转换为AppError
  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof Error) {
    appError = new AppError(
      ErrorType.INTERNAL_ERROR,
      error.message,
      500,
      { originalError: error.name, stack: error.stack }
    )
  } else {
    appError = new AppError(
      ErrorType.INTERNAL_ERROR,
      '未知错误',
      500,
      { originalError: String(error) }
    )
  }

  // 确定HTTP状态码
  statusCode = getStatusCodeFromErrorType(appError.type)

  // 记录错误日志
  logError(appError, context, duration)

  // 创建错误响应
  const errorResponse: APIResponse = {
    success: false,
    error: {
      type: appError.type,
      message: appError.message,
      details: appError.details,
      timestamp: new Date(),
      requestId: context.requestId
    },
    timestamp: new Date()
  }

  // 在开发环境中包含更多调试信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = appError.stack
    errorResponse.error.context = context
  }

  return NextResponse.json(errorResponse, { status: statusCode })
}

/**
 * 记录错误日志
 */
function logError(error: AppError, context: ErrorContext, duration?: number): void {
  const logContext = {
    ...context,
    errorType: error.type,
    statusCode: getStatusCodeFromErrorType(error.type),
    details: error.details,
    duration
  }

  // 根据错误类型选择日志级别
  switch (error.type) {
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.NOT_FOUND:
      logger.warn(error.message, logContext)
      break
    
    case ErrorType.UNAUTHORIZED:
    case ErrorType.FORBIDDEN:
      logger.security(error.message, logContext)
      break
    
    case ErrorType.RATE_LIMIT_EXCEEDED:
      logger.warn(`Rate limit exceeded: ${error.message}`, logContext)
      break
    
    case ErrorType.INTERNAL_ERROR:
    case ErrorType.DATABASE_ERROR:
    case ErrorType.EXTERNAL_SERVICE_ERROR:
    default:
      logger.error(error.message, error, logContext)
      break
  }
}

/**
 * 根据错误类型获取HTTP状态码
 */
function getStatusCodeFromErrorType(errorType: ErrorType): number {
  switch (errorType) {
    case ErrorType.VALIDATION_ERROR:
      return 400
    case ErrorType.UNAUTHORIZED:
      return 401
    case ErrorType.FORBIDDEN:
      return 403
    case ErrorType.NOT_FOUND:
      return 404
    case ErrorType.RATE_LIMIT_EXCEEDED:
      return 429
    case ErrorType.INTERNAL_ERROR:
    case ErrorType.DATABASE_ERROR:
    case ErrorType.EXTERNAL_SERVICE_ERROR:
    default:
      return 500
  }
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取客户端IP地址
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP || remoteAddr || 'unknown'
}

/**
 * 创建用户友好的错误消息
 */
export function createUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.VALIDATION_ERROR:
      return '输入的数据格式不正确，请检查后重试'
    case ErrorType.UNAUTHORIZED:
      return '请先登录后再进行此操作'
    case ErrorType.FORBIDDEN:
      return '您没有权限执行此操作'
    case ErrorType.NOT_FOUND:
      return '请求的资源不存在'
    case ErrorType.RATE_LIMIT_EXCEEDED:
      return '请求过于频繁，请稍后再试'
    case ErrorType.DATABASE_ERROR:
      return '数据库操作失败，请稍后重试'
    case ErrorType.EXTERNAL_SERVICE_ERROR:
      return '外部服务暂时不可用，请稍后重试'
    case ErrorType.INTERNAL_ERROR:
    default:
      return '服务器内部错误，请稍后重试'
  }
}

/**
 * 异步错误处理装饰器
 */
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      // 重新抛出错误，让上层处理
      throw error
    }
  }
}

/**
 * API错误处理辅助函数
 */
export function handleApiError(error: unknown, message: string = '操作失败'): Response {
  return handleError(error, { endpoint: 'api' });
}

/**
 * 错误边界辅助函数
 */
export function captureError(error: Error, context?: Record<string, any>): void {
  logger.error('Uncaught error', error, context)

  // 在生产环境中可以发送到错误监控服务
  if (process.env.NODE_ENV === 'production') {
    // 例如发送到 Sentry, Bugsnag 等
  }
}
