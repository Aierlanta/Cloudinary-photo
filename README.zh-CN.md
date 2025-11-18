简体中文（当前） ｜ [English](./README.md)

# 随机图片 API 服务

[![wakatime](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d.svg)](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d)

基于 Next.js 14 的随机图片 API 服务，支持多图床存储, 完整的管理面板。

## 预览

### 首页预览

<img width="2548" height="1315" alt="image" src="https://github.com/user-attachments/assets/c9f9b5d5-45f6-44c5-8086-286ebe42766d" />

### 仪表盘

<img width="2560" height="1316" alt="image" src="https://github.com/user-attachments/assets/05cb8c91-f2ca-425c-ba63-cb6b2163ab5b" />

### 图片管理

<img width="2558" height="1314" alt="image" src="https://github.com/user-attachments/assets/3335edca-b09d-45f0-bb45-9ffe1346e27c" />

### 分组管理

<img width="2560" height="1321" alt="image" src="https://github.com/user-attachments/assets/95e31a3d-cd33-4dff-abba-e280273ec09d" />

### API 配置

<img width="2560" height="1312" alt="image" src="https://github.com/user-attachments/assets/1d33cb5b-ee1e-49a6-96e2-781eb030c60d" />

### 系统状态

<img width="2560" height="1306" alt="image" src="https://github.com/user-attachments/assets/4fdf46e7-54e7-4169-84c6-369179bfd9fc" />

### 系统日志

<img width="2556" height="1310" alt="image" src="https://github.com/user-attachments/assets/651e9756-7c76-4f69-b0f3-b3a07d044c30" />

### 备份管理

<img width="2560" height="1306" alt="image" src="https://github.com/user-attachments/assets/a3801ac3-1592-4641-8d5a-d5ca0eb29730" />

## 快速开始

### 环境要求

- Node.js 22+
- MySQL 8.0+
- npm 或 yarn 包管理器

### 环境变量配置

创建 `.env.local` 文件并配置以下环境变量：

```env
# 数据库配置
DATABASE_URL="mysql://username:password@host:port/database"

# Cloudinary 图床配置（主图床）
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# TgState 图床配置（可选，第三方服务）
TGSTATE_BASE_URL=https://your-tgstate-domain.com
# TgState 图片代理URL（可选，用于加速访问或CDN加速）
# 如果配置了此项，API返回的图片URL将使用代理地址
# TGSTATE_PROXY_URL=https://tg-img.your-domain.com
# 或使用 Cloudflare Worker 等反代服务：
# TGSTATE_PROXY_URL=https://tg-proxy.workers.dev

# Telegram 直连配置（推荐，无需第三方服务）
# 支持多个 Bot Token (逗号分隔),实现轮询和负载均衡,防止单个 token 被限速
TELEGRAM_BOT_TOKENS=token1,token2,token3
# 或单个 Token
# TELEGRAM_BOT_TOKEN=your_bot_token
# 可选: 指定上传到的 chat_id (默认使用 bot 自己的 Saved Messages)
# TELEGRAM_CHAT_ID=your_chat_id

# 图床开关（可选，未设置则默认启用）
CLOUDINARY_ENABLE=true
TGSTATE_ENABLE=false
TELEGRAM_ENABLE=true

# 管理员认证
ADMIN_PASSWORD=your_secure_admin_password

# 会话安全（可选，未设置时自动生成）
# SESSION_SECRET=your_random_secret_key_for_session_signing
```

#### 按需启用/禁用图床服务

通过环境变量控制启用哪些图床，未设置时默认启用：

```env
# 图床开关（未设置即为启用）
CLOUDINARY_ENABLE=true
TGSTATE_ENABLE=false
TELEGRAM_ENABLE=true
```

- 设为 `false` 即禁用对应图床（例如仅启用 Telegram：`CLOUDINARY_ENABLE=false TGSTATE_ENABLE=false`）。
- 当所有图床均为 `false` 时，上传接口将返回 `503 未启用任何图床服务`。
- 多图床管理器仅会注册已启用的服务；前端/接口的“可选图床列表”和默认图床也将随之变化。

#### Telegram 直连 vs TgState

**推荐使用 Telegram 直连模式**，优势如下：

- ✅ **无需第三方服务**：直接使用 Telegram Bot API，无需部署 TgState
- ✅ **多 Token 负载均衡**：支持多个 Bot Token 轮询，防止单个 token 被限速
- ✅ **自动缩略图**：Telegram 自动生成 320x320 缩略图（~40KB），管理面板加载更快
- ✅ **健康检查**：自动检测 token 健康状态，失败自动切换
- ⚠️ **仅新图片**：只有新上传的图片才有缩略图优化，旧图片继续使用原有优化方案

### 安装和部署

#### 开发环境

```bash
# 1. 克隆项目
git clone https://github.com/Aierlanta/Cloudinary-photo.git
cd Cloudinary-photo

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 文件，填入你的配置

# 4. 初始化数据库
npx prisma generate
npx prisma migrate dev

# 5. 启动开发服务器
npm run dev
```

#### 生产环境

```bash
# 1. 构建项目
npm run build

# 2. 启动生产服务器
npm run start

# 或使用快速启动脚本
chmod +x fast-start.sh
./fast-start.sh
```

## API 接口文档

### 公开 API

#### API Key 鉴权（可选）

如果在管理面板中启用了 API Key 鉴权，所有公开 API 请求都必须包含 `key` 参数：

```bash
# 未启用 API Key 鉴权时
GET /api/random

# 启用 API Key 鉴权后
GET /api/random?key=你的API密钥

# 与其他参数组合使用
GET /api/random?group=wallpaper&key=你的API密钥
```

**配置方法**:

- 进入管理后台 → API 配置管理 → API Key 鉴权
- 启用 API Key 鉴权
- 生成或输入自定义 API Key
- 所有 API 请求都需要携带 `key` 参数

**错误响应**:

- `401 Unauthorized` - 启用鉴权后缺少 API Key
- `401 Unauthorized` - API Key 无效

#### 随机图片接口

```http
GET /api/random
```

**功能**: 获取随机图片，支持分组筛选和参数配置
**响应**: 302 重定向到图片 URL
**参数**:

- `key` - API 密钥（启用鉴权时必需）
- 支持自定义参数（通过管理面板配置）
- 例如: `?group=wallpaper&category=nature`
- 带密钥示例: `?group=wallpaper&key=你的API密钥`

#### 直接响应接口

```http
GET /api/response
```

**功能**: 直接返回图片数据（可选功能）
**响应**: 图片二进制数据
**用途**: 适用于需要直接获取图片内容的场景

**参数**:

- `key` - API 密钥（启用鉴权时必需）
- `opacity` - 图片透明度（0-1.0），0 表示完全透明，1 表示完全不透明（可选）
- `bgColor` - 背景颜色（可选），支持以下格式：
  - 预设颜色名称：`white`（默认）、`black`
  - 十六进制：`ffffff` 或 `#ffffff`

**使用示例**:

```bash
# 原始图片（无透明度调整）
GET /api/response

# 使用 API Key
GET /api/response?key=你的API密钥

# 50% 透明度，白色背景
GET /api/response?opacity=0.5&bgColor=white

# 80% 透明度，黑色背景，带 API Key
GET /api/response?opacity=0.8&bgColor=black&key=你的API密钥

# 30% 透明度，自定义颜色背景
GET /api/response?opacity=0.3&bgColor=ff6b6b
```

**注意事项**:

- 透明度处理会将图片转换为 JPEG 格式（质量 90）
- 使用透明度参数时不会使用预取缓存，响应时间会略长
- 如果未指定 `bgColor`，默认使用白色背景

- 预取（更新）

  - 每次成功返回后在后台预取下一张随机图片，并缓存在内存“单槽”中
  - 单槽按筛选条件（如分组映射）划分；命中后即时返回并“消费清空”，随后异步预取下一张补位
  - 无 TTL（不会因时间过期）；缓存为实例进程内存，实例重启/缩容后会丢失，首次请求为冷启动
  - 响应头：`X-Transfer-Mode`（`buffered` | `prefetch`），`X-Image-Size`
  - 预取失败不影响当前请求，仅记录日志

- 传输兼容（新增）

  - Cloudinary 资源通过 Cloudinary 下载；非 Cloudinary 资源统一使用数据库中的源 URL 抓取
  - 对 `4xx`（除 `429`）不重试；失败会自动回退至源 URL
  - 所有抓取均使用 `fetch(..., { cache: 'no-store' })`，避免 Next 数据缓存 2MB 限制

- 部署提示（Replit autoscale）
  - 单槽缓存位于实例进程内存；空闲缩容至 0 或实例重启后缓存会丢失，随后首个请求为冷启动
  - 多实例并发时各实例各自维护单槽缓存，彼此不共享

#### 系统状态接口

```http
GET /api/status
GET /api/health
```

**功能**: 系统健康检查和状态监控
**响应**: JSON 格式的系统状态信息

### 管理 API（需要认证）

#### 图片管理

```http
GET    /api/admin/images           # 获取图片列表（支持分页、筛选）
POST   /api/admin/images           # 上传图片（支持批量上传）
PUT    /api/admin/images/[id]      # 更新图片信息
DELETE /api/admin/images/[id]      # 删除图片
```

#### 分组管理

```http
GET    /api/admin/groups           # 获取分组列表
POST   /api/admin/groups           # 创建分组
PUT    /api/admin/groups/[id]      # 更新分组信息
DELETE /api/admin/groups/[id]      # 删除分组
```

#### 系统配置

```http
GET    /api/admin/config           # 获取 API 配置
PUT    /api/admin/config           # 更新 API 配置
GET    /api/admin/settings         # 获取系统设置
PUT    /api/admin/settings         # 更新系统设置
```

#### 存储管理

```http
GET    /api/admin/storage          # 获取存储配置
PUT    /api/admin/storage          # 更新存储配置
GET    /api/admin/image-hosts      # 获取图床状态
POST   /api/admin/multi-host       # 多图床操作
```

#### 系统监控

```http
GET    /api/admin/stats            # 获取系统统计
GET    /api/admin/logs             # 获取系统日志
GET    /api/admin/health           # 获取详细健康状态
POST   /api/admin/backup           # 创建数据备份
```

#### 风控管理（v1.4.0 新增）

```http
GET    /api/admin/security/stats           # 获取访问统计
GET    /api/admin/security/banned-ips      # 获取封禁IP列表
POST   /api/admin/security/banned-ips      # 封禁IP地址
DELETE /api/admin/security/banned-ips      # 解封IP地址
GET    /api/admin/security/rate-limits     # 获取IP速率限制配置
POST   /api/admin/security/rate-limits     # 设置IP速率限制
DELETE /api/admin/security/rate-limits     # 移除IP速率限制
GET    /api/admin/security/ip-info         # 获取IP信息和统计
```

## CDN 配置建议

- **目标**

  - 保持 `/api/response` 在浏览器/CDN 侧不被缓存，保证随机性；
  - 降低时延依赖服务端进程内的“预取单槽”机制，而非边缘缓存。

- **必需设置**

  - 遵守源站响应头：`Cache-Control: no-cache, no-store, must-revalidate`，`Pragma: no-cache`，`Expires: 0`；
  - 为路径 `/api/response*` 添加“绕过/禁止缓存”的规则；
  - 可选：若 CDN 支持，在边缘强制 `Surrogate-Control: no-store`，避免中间代理误缓存。

- **平台指引**

  - **Cloudflare**
    - Cache Rule 或 Page Rule：条件 `URI Path` 匹配 `/api/response*`；
    - 动作：`Cache level = Bypass`，`Origin Cache Control = On`，`Edge TTL = 0`；避免重写缓存头。
  - **Vercel**
    - 路由已声明 `dynamic = 'force-dynamic'`，Vercel 默认不缓存；
    - 若前置了外部 CDN/反代，仍需在该层对 `/api/response*` 绕过缓存。
  - **AWS CloudFront**
    - 为 `/api/response*` 配置 Behavior：`Cache policy = CachingDisabled`（或自定义 TTL=0 且遵守源站）；
      合理设置 `Origin request policy`。
  - **Nginx / 反向代理**

    - 示例：

      ```nginx
      location /api/response {
          expires off;
          add_header Cache-Control "no-cache, no-store, must-revalidate" always;
          add_header Pragma "no-cache" always;
          add_header Expires "0" always;
          proxy_pass http://your_upstream;
      }
      ```

  - **Fastly / Akamai**
    - Fastly VCL：对 `/api/response*` 设置 `beresp.http.Surrogate-Control = "no-store"` 且 `beresp.ttl = 0s`；
    - Akamai：在属性中启用“遵守源站 no-store”并对该路径禁用缓存。

- **排障建议**
  - 若仍出现缓存复用导致图片重复：
    - 检查响应/边缘头部（如 `CF-Cache-Status`、`X-Cache`、`Age`）；
    - 关闭任何会改写缓存头的 Worker/Transform；
    - 确认 URL 未被重写从而绕开了你的匹配规则。

## 功能特性

### 核心功能

- **随机图片 API**: 快速的随机图片获取，支持分组过滤
- **多图床存储**: 支持 Cloudinary 和 TgState，具备自动故障转移
- **管理面板**: 完整的 Web 管理界面，用于图片和分组管理
- **API Key 认证**: 可选的 API Key 认证功能，保护公共端点
- **图片处理**: 支持透明度调整和背景颜色自定义
- **预取缓存**: 单槽内存缓存，提升响应速度
- **风控管理** (v1.4.0): 访问日志、IP 封禁和速率限制
- **国际化**: 支持中英文双语
- **主题系统**: 深色/浅色模式，支持系统偏好检测
- **备份与恢复**: 自动数据库备份，一键恢复功能

### 安全功能

- **访问控制**: 基于角色的管理员认证，使用会话令牌
- **速率限制**: 可配置的 IP 速率限制
- **IP 封禁**: 自动或手动封禁恶意 IP
- **访问日志**: 详细的访问日志，包含 IP 跟踪和统计
- **会话安全**: HMAC-SHA256 签名的会话令牌，增强安全性

## 项目架构

### 目录结构

```text
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/             # 管理面板页面
│   │   │   ├── images/        # 图片管理页面
│   │   │   ├── groups/        # 分组管理页面
│   │   │   ├── config/        # API配置页面
│   │   │   ├── storage/       # 存储管理页面
│   │   │   ├── security/      # 风控管理页面（v1.4.0）
│   │   │   ├── logs/          # 日志查看页面
│   │   │   └── status/        # 系统状态页面
│   │   ├── api/               # API 路由
│   │   │   ├── random/        # 随机图片API
│   │   │   ├── response/      # 直接响应API
│   │   │   ├── admin/         # 管理API
│   │   │   └── health/        # 健康检查API
│   │   ├── globals.css        # 全局样式
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 首页
│   ├── components/            # React 组件
│   │   ├── admin/             # 管理面板组件
│   │   ├── ui/                # 基础UI组件
│   │   └── ErrorBoundary.tsx  # 错误边界
│   ├── lib/                   # 核心业务逻辑
│   │   ├── storage/           # 存储服务
│   │   │   ├── base.ts        # 存储接口定义
│   │   │   ├── cloudinary.ts  # Cloudinary服务
│   │   │   ├── tgstate.ts     # TgState服务
│   │   │   ├── manager.ts     # 多图床管理器
│   │   │   ├── factory.ts     # 服务工厂
│   │   │   └── config.ts      # 存储配置（v1.2.1）
│   │   ├── database/          # 数据库服务
│   │   ├── auth.ts            # 认证服务
│   │   ├── security.ts        # 安全中间件
│   │   ├── access-tracking.ts # 访问日志（v1.4.0）
│   │   ├── ip-management.ts   # IP管理（v1.4.0）
│   │   ├── backup.ts          # 备份服务
│   │   ├── logger.ts          # 日志服务
│   │   ├── image-utils.ts     # 图片工具函数
│   │   └── utils.ts           # 工具函数
│   ├── types/                 # TypeScript 类型定义
│   │   ├── models.ts          # 数据模型
│   │   ├── api.ts             # API类型
│   │   ├── errors.ts          # 错误类型
│   │   └── schemas.ts         # 验证模式
│   ├── i18n/                  # 国际化（v1.0.0）
│   │   ├── locales/           # 语言文件
│   │   │   ├── en.ts          # 英文翻译
│   │   │   └── zh.ts          # 中文翻译
│   │   ├── context.tsx        # 语言上下文
│   │   └── types.ts           # i18n 类型
│   ├── hooks/                 # React Hooks
│   └── middleware.ts          # Next.js 中间件
├── prisma/                    # 数据库
│   ├── schema.prisma          # 数据库模式
│   └── migrations/            # 数据库迁移
├── tests/                     # 测试文件
├── scripts/                   # 构建脚本
├── fast-start.sh              # 快速启动脚本
└── 配置文件
    ├── next.config.js         # Next.js配置
    ├── tailwind.config.ts     # Tailwind配置
    ├── jest.config.js         # Jest配置
    └── tsconfig.json          # TypeScript配置
```

### 核心模块说明

#### 存储系统 (`src/lib/storage/`)

- **多图床架构**: 支持 Cloudinary 和 TgState
- **故障转移**: 自动检测服务状态，智能切换
- **统一接口**: 抽象存储操作，便于扩展新的图床服务
- **动态配置** (v1.2.0): 通过环境变量启用/禁用存储提供商
- **代理支持** (v1.3.0): TgState 代理 URL，支持 CDN 加速

#### 安全系统 (`src/lib/security.ts`, `src/lib/ip-management.ts`)

- **请求限流**: 防止 API 滥用，支持可配置的 IP 速率限制
- **IP 封禁** (v1.4.0): 自动和手动 IP 封禁
- **访问追踪** (v1.4.0): 全面的访问日志和统计
- **参数验证**: 严格的输入校验
- **访问控制**: 基于角色的权限管理
- **会话安全** (v1.2.4): HMAC-SHA256 签名的会话令牌

#### 监控系统 (`src/lib/logger.ts`)

- **结构化日志**: 统一的日志格式
- **性能监控**: API 响应时间追踪
- **错误追踪**: 详细的错误信息记录
- **访问分析** (v1.4.0): 基于 IP 的访问统计和趋势

#### 备份系统 (`src/lib/backup.ts`)

- **自动备份**: 定时数据库备份
- **一键恢复**: 快速从备份恢复数据库
- **原子操作** (v1.4.5): 确保恢复过程中的数据一致性
- **错误恢复**: 增强的错误处理和回滚机制

## 开发命令

```bash
# 开发相关
npm run dev              # 启动开发服务器 (localhost:3000)
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # ESLint 代码检查
npm run type-check       # TypeScript 类型检查

# 测试相关
npm run test             # 运行所有测试
npm run test:watch       # 监听模式运行测试
npm run test:coverage    # 生成测试覆盖率报告

# 数据库相关
npx prisma generate      # 生成 Prisma 客户端
npx prisma migrate dev   # 运行数据库迁移（开发环境）
npx prisma migrate deploy # 运行数据库迁移（生产环境）
npx prisma studio        # 打开 Prisma Studio 数据库管理界面

# 生产部署
./fast-start.sh          # 快速启动脚本（生产环境）
```

## 高级配置

### 多图床配置

项目支持多图床架构，提供更高的可用性和容错能力：

#### Cloudinary

- **优势**: 专业的图片 CDN 服务，全球节点，图片处理能力强
- **配置**: 需要 Cloud Name、API Key 和 API Secret
- **适用**: 生产环境推荐

#### TgState

- **优势**: 基于 Telegram 的免费图床服务，无审查限制
- **项目地址**: [TgState GitHub](https://github.com/csznet/tgState)
- **配置**: 需要部署 TgState 服务并获取访问令牌

## 监控和维护

### 健康监控

- **健康检查**: `/api/health` 端点提供系统状态
- **性能指标**: API 响应时间、成功率统计
- **资源监控**: 数据库连接、存储使用情况
- **错误追踪**: 详细的错误日志和堆栈信息

### 安全监控（v1.4.0）

- **访问统计**: 实时访问计数和趋势
- **IP 追踪**: 监控 IP 地址和访问模式
- **速率限制监控**: 追踪速率限制违规
- **封禁 IP 管理**: 查看和管理被封禁的 IP 地址

### 数据备份

- **自动备份**: 定时数据库备份，可配置备份间隔
- **手动备份**: 管理面板支持一键备份
- **恢复机制**: 快速恢复数据和配置，支持原子操作
- **备份状态**: 实时备份状态和历史记录追踪

### 日志管理

- **结构化日志**: JSON 格式，便于分析
- **访问日志** (v1.4.0): 详细的请求日志，包含 IP 和端点信息
- **日志轮转**: 自动清理过期日志
- **日志查询**: 管理面板支持日志搜索和筛选

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。

## 致谢

- [Next.js](https://nextjs.org/) - 强大的 React 框架
- [Prisma](https://www.prisma.io/) - 现代化的数据库工具
- [Cloudinary](https://cloudinary.com/) - 专业的图片云服务
- [TgState](https://github.com/csznet/tgState) - 开源的 Telegram 图床服务
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

---

**当前版本**: v1.5.0 | **最后更新**: 2025-11-17

如有问题或建议，欢迎提交 Issue 或 Pull Request！
