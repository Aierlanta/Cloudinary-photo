# 安全中间件和认证系统

## 概述

本项目实现了完整的安全中间件和认证系统，包括：

1. **管理员认证中间件** (`auth.ts`)
2. **安全中间件** (`security.ts`) 
3. **全局中间件** (`middleware.ts`)

## 功能特性

### 1. 认证中间件 (auth.ts)

- **多种认证方式支持**：
  - Authorization Bearer token
  - X-Admin-Password 头
  - 查询参数 (仅用于测试)

- **认证装饰器**：
  - `withAdminAuth()` - 为API端点添加认证保护
  - `verifyAdminAuth()` - 验证管理员权限
  - `createAuthResponse()` - 创建标准认证错误响应

### 2. 安全中间件 (security.ts)

- **API限流保护**：
  - 内存存储的限流机制
  - 支持不同API端点的不同限流配置
  - 自动清理过期记录
  - 基于IP地址的限流

- **请求验证**：
  - HTTP方法验证
  - Content-Type验证
  - 请求大小限制
  - 参数验证

- **安全头设置**：
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Content-Security-Policy
  - Strict-Transport-Security (生产环境)
  - Referrer-Policy
  - Permissions-Policy

- **安全装饰器**：
  - `withSecurity()` - 为API端点添加安全保护
  - 支持组合多种安全检查

### 3. 全局中间件 (middleware.ts)

- **CORS支持**：
  - 跨域请求处理
  - 预检请求处理
  - 安全的CORS头设置

- **请求追踪**：
  - 自动生成请求ID
  - 便于日志追踪和调试

## 限流配置

系统预定义了三种限流配置：

```typescript
const DEFAULT_RATE_LIMITS = {
  // 公开API限流 - 每分钟60次请求
  public: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: 'API请求过于频繁，请稍后再试'
  },
  // 管理API限流 - 每分钟120次请求
  admin: {
    windowMs: 60 * 1000,
    maxRequests: 120,
    message: '管理API请求过于频繁，请稍后再试'
  },
  // 上传API限流 - 每分钟10次请求
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: '上传请求过于频繁，请稍后再试'
  }
};
```

## 使用示例

### 1. 保护管理员API端点

```typescript
// 应用安全中间件和认证
export const GET = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['GET']
})(withAdminAuth(getImages));

export const POST = withSecurity({
  rateLimit: 'upload',
  allowedMethods: ['POST'],
  allowedContentTypes: ['multipart/form-data'],
  maxRequestSize: 10 * 1024 * 1024 // 10MB
})(withAdminAuth(uploadImage));
```

### 2. 保护公开API端点

```typescript
// 应用安全中间件
export const GET = withSecurity({
  rateLimit: 'public',
  allowedMethods: ['GET']
})(getRandomImage);
```

### 3. 自定义限流配置

```typescript
export const POST = withSecurity({
  rateLimit: {
    windowMs: 60000,
    maxRequests: 5,
    message: '自定义限流消息'
  },
  allowedMethods: ['POST']
})(handler);
```

## 环境变量

系统需要以下环境变量：

```bash
# 管理员密码
ADMIN_PASSWORD=your-secure-password

# 生产环境标识（用于启用HSTS）
NODE_ENV=production
```

## 安全特性

1. **防止XSS攻击**：设置适当的安全头
2. **防止点击劫持**：X-Frame-Options: DENY
3. **内容类型嗅探保护**：X-Content-Type-Options: nosniff
4. **HTTPS强制**：生产环境启用HSTS
5. **API限流**：防止滥用和DDoS攻击
6. **请求验证**：严格的输入验证
7. **认证保护**：管理员功能需要认证

## 监控和调试

- **限流统计**：`getRateLimitStats()` 获取当前限流状态
- **请求追踪**：每个请求都有唯一的Request ID
- **错误日志**：详细的错误信息和上下文
- **安全头验证**：自动设置所有必要的安全头

## 测试

系统包含完整的测试套件：

- 认证中间件测试
- 安全中间件测试
- 集成测试
- 限流功能测试
- 安全头验证测试

运行测试：
```bash
npm test -- --testPathPattern="security|auth"
```

## 性能考虑

1. **内存限流存储**：适合中小型应用，大型应用建议使用Redis
2. **自动清理**：定期清理过期的限流记录
3. **最小化开销**：安全检查设计为高效执行
4. **缓存友好**：支持适当的缓存策略

## 部署注意事项

1. **环境变量**：确保在生产环境中设置强密码
2. **HTTPS**：生产环境必须使用HTTPS
3. **反向代理**：如使用Nginx等，需要正确配置IP转发
4. **监控**：建议监控限流统计和错误日志

这个安全系统为随机图片API提供了全面的保护，确保系统的安全性和稳定性。