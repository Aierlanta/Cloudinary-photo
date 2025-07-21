# 随机图片 API 服务

[![wakatime](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d.svg)](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d)

基于 Next.js 14 的高性能随机图片 API 服务，集成 Cloudinary CDN 和 MySQL 数据库。

## 功能特性

- **图片管理** - 上传、删除、分组管理图片
- **随机 API** - RESTful API，支持参数筛选
- **管理面板** - 现代化 Web 界面，支持透明度调节
- **灵活配置** - API 参数配置和访问控制
- **系统监控** - 日志记录、健康检查、统计信息
- **安全认证** - 管理员身份验证

## 技术栈

- **框架**: Next.js 14 (App Router) + TypeScript
- **数据库**: MySQL + Prisma ORM
- **图片存储**: Cloudinary CDN
- **样式**: Tailwind CSS
- **测试**: Jest + Testing Library

## 快速开始

### 环境变量配置

```env
# Cloudinary配置
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# 数据库配置
DATABASE_URL="mysql://username:password@host:port/database"

# 管理员配置
ADMIN_PASSWORD=your_admin_password
```

### 安装和运行

```bash
# 安装依赖
npm install

# 数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build && npm start
```

## API 端点

### 公开 API

```http
GET /api/random          # 获取随机图片（支持参数筛选）
GET /api/status          # 系统状态检查
```

### 管理 API（需要认证）

```http
GET    /api/admin/images      # 获取图片列表
POST   /api/admin/images      # 上传图片
DELETE /api/admin/images/[id] # 删除图片
GET    /api/admin/groups      # 获取分组列表
POST   /api/admin/groups      # 创建分组
GET    /api/admin/config      # 获取API配置
```

## 项目结构

```text
src/
├── app/                 # Next.js App Router
│   ├── admin/          # 管理面板页面
│   └── api/            # API路由
├── components/         # React组件
├── lib/               # 核心业务逻辑
├── types/             # TypeScript类型定义
└── hooks/             # React Hooks
prisma/                # 数据库模式
```

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run type-check   # TypeScript类型检查
npm run test         # 运行测试
```

# tgstate

鉴于 cloudinary 有审查, 所以可选择接入 tgstate 作为备用图床
https://github.com/csznet/tgState
