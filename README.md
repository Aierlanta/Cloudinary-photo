# 随机图片API服务

基于Next.js的随机图片API服务，集成Cloudinary图床和Replit数据库。

## 功能特性

- 🖼️ 图片上传和管理
- 📁 图片分组管理
- 🎲 随机图片API
- ⚙️ API参数配置
- 🎨 透明度可调的管理面板
- 🔒 简单的管理员认证

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **图片存储**: Cloudinary
- **数据库**: Replit Database
- **部署**: Replit

## 快速开始

### 1. 环境变量配置

在Replit Secrets中配置以下环境变量：

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ADMIN_PASSWORD=your_admin_password
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
npm start
```

## API端点

### 公开API
- `GET /api/random` - 获取随机图片（支持参数筛选）

### 管理API（需要认证）
- `GET /api/admin/images` - 获取图片列表
- `POST /api/admin/images` - 上传图片
- `DELETE /api/admin/images/[id]` - 删除图片
- `GET /api/admin/groups` - 获取分组列表
- `POST /api/admin/groups` - 创建分组
- `GET /api/admin/config` - 获取API配置

## 项目结构

```
src/
├── app/                 # Next.js App Router
├── lib/                 # 工具函数和配置
├── types/               # TypeScript类型定义
└── components/          # React组件（待创建）
```

## 开发命令

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run lint` - 运行ESLint
- `npm run type-check` - TypeScript类型检查
Cloudinary图床
