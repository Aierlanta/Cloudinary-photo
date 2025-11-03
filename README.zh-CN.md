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

# TgState 图床配置（可选）
TGSTATE_BASE_URL=https://your-tgstate-domain.com

# 管理员认证
ADMIN_PASSWORD=your_secure_admin_password
```

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

#### 随机图片接口

```http
GET /api/random
```

**功能**: 获取随机图片，支持分组筛选和参数配置
**响应**: 302 重定向到图片 URL
**参数**:

- 支持自定义参数（通过管理面板配置）
- 例如: `?group=wallpaper&category=nature`

#### 直接响应接口

```http
GET /api/response
```

**功能**: 直接返回图片数据（可选功能）
**响应**: 图片二进制数据
**用途**: 适用于需要直接获取图片内容的场景

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
│   │   │   └── factory.ts     # 服务工厂
│   │   ├── database/          # 数据库服务
│   │   ├── auth.ts            # 认证服务
│   │   ├── security.ts        # 安全中间件
│   │   ├── logger.ts          # 日志服务
│   │   └── utils.ts           # 工具函数
│   ├── types/                 # TypeScript 类型定义
│   │   ├── models.ts          # 数据模型
│   │   ├── api.ts             # API类型
│   │   ├── errors.ts          # 错误类型
│   │   └── schemas.ts         # 验证模式
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

#### 安全系统 (`src/lib/security.ts`)

- **请求限流**: 防止 API 滥用
- **参数验证**: 严格的输入校验
- **访问控制**: 基于角色的权限管理

#### 监控系统 (`src/lib/logger.ts`)

- **结构化日志**: 统一的日志格式
- **性能监控**: API 响应时间追踪
- **错误追踪**: 详细的错误信息记录

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

### 系统监控

- **健康检查**: `/api/health` 端点提供系统状态
- **性能指标**: API 响应时间、成功率统计
- **资源监控**: 数据库连接、存储使用情况
- **错误追踪**: 详细的错误日志和堆栈信息

### 数据备份

- **自动备份**: 定期备份数据库和配置
- **手动备份**: 管理面板支持一键备份
- **恢复机制**: 快速恢复数据和配置

### 日志管理

- **结构化日志**: JSON 格式，便于分析
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

**当前版本**: v0.7.0 | **最后更新**: 2025-11-03

如有问题或建议，欢迎提交 Issue 或 Pull Request！
