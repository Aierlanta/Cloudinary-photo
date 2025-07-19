/**
 * 统一日志记录工具
 * 支持不同级别的日志记录和格式化
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
  userId?: string
  requestId?: string
  ip?: string
  userAgent?: string
}

export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  maxLogSize: number
  retentionDays: number
}

class Logger {
  private config: LoggerConfig
  private static instance: Logger

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      maxLogSize: 10 * 1024 * 1024, // 10MB
      retentionDays: 30,
      ...config
    }
  }

  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config)
    }
    return Logger.instance
  }

  /**
   * 记录调试信息
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * 记录一般信息
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * 记录警告信息
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * 记录错误信息
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  /**
   * 记录API请求
   */
  apiRequest(method: string, path: string, context?: Record<string, any>): void {
    this.info(`API ${method} ${path}`, {
      type: 'api_request',
      method,
      path,
      ...context
    })
  }

  /**
   * 记录API响应
   */
  apiResponse(method: string, path: string, status: number, duration: number, context?: Record<string, any>): void {
    const level = status >= 400 ? LogLevel.ERROR : status >= 300 ? LogLevel.WARN : LogLevel.INFO
    this.log(level, `API ${method} ${path} - ${status} (${duration}ms)`, {
      type: 'api_response',
      method,
      path,
      status,
      duration,
      ...context
    })
  }

  /**
   * 记录数据库操作
   */
  database(operation: string, table: string, context?: Record<string, any>): void {
    this.debug(`DB ${operation} ${table}`, {
      type: 'database',
      operation,
      table,
      ...context
    })
  }

  /**
   * 记录用户操作
   */
  userAction(action: string, userId: string, context?: Record<string, any>): void {
    this.info(`User ${action}`, {
      type: 'user_action',
      action,
      userId,
      ...context
    })
  }

  /**
   * 记录安全事件
   */
  security(event: string, context?: Record<string, any>): void {
    this.warn(`Security: ${event}`, {
      type: 'security',
      event,
      ...context
    })
  }

  /**
   * 核心日志记录方法
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.config.level) {
      return
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    }

    // 控制台输出
    if (this.config.enableConsole) {
      this.logToConsole(logEntry)
    }

    // 文件输出（在生产环境中可以实现）
    if (this.config.enableFile) {
      this.logToFile(logEntry)
    }

    // 远程日志服务（如果配置了）
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.logToRemote(logEntry)
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const levelName = LogLevel[entry.level]
    const prefix = `[${timestamp}] [${levelName}]`

    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? ` Error: ${entry.error.message}\n${entry.error.stack}` : ''

    const fullMessage = `${prefix} ${entry.message}${contextStr}${errorStr}`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage)
        break
      case LogLevel.INFO:
        console.info(fullMessage)
        break
      case LogLevel.WARN:
        console.warn(fullMessage)
        break
      case LogLevel.ERROR:
        console.error(fullMessage)
        break
    }
  }

  /**
   * 输出到文件（占位符实现）
   */
  private logToFile(entry: LogEntry): void {
    // 在实际生产环境中，这里可以实现文件写入逻辑
    // 例如使用 fs.appendFile 或日志轮转库
  }

  /**
   * 发送到远程日志服务（占位符实现）
   */
  private logToRemote(entry: LogEntry): void {
    // 在实际生产环境中，这里可以发送到远程日志服务
    // 例如 Elasticsearch, Splunk, 或云日志服务
  }

  /**
   * 格式化错误对象
   */
  static formatError(error: Error): Record<string, any> {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...((error as any).cause && { cause: (error as any).cause })
    }
  }

  /**
   * 创建请求上下文
   */
  static createRequestContext(request: Request): Record<string, any> {
    return {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown'
    }
  }

  /**
   * 获取性能指标
   */
  static getPerformanceMetrics(): Record<string, any> {
    if (typeof performance !== 'undefined') {
      return {
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : undefined,
        timing: performance.now()
      }
    }
    return {}
  }
}

// 导出单例实例
export const logger = Logger.getInstance({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableFile: process.env.NODE_ENV === 'production',
  enableRemote: false
})

export default logger
