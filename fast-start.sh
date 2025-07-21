#!/bin/bash

# 随机图片API服务 - 生产环境启动脚本
echo "🚀 启动随机图片API生产服务..."

# 检查Node.js版本
echo "📋 检查运行环境..."
node --version
npm --version

# 安装生产依赖和构建依赖
echo "📦 安装项目依赖..."
npm ci --include=dev

# 检查关键环境变量
echo "🔧 验证环境配置..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 环境变量未设置"
    exit 1
fi

if [ -z "$CLOUDINARY_CLOUD_NAME" ]; then
    echo "❌ 错误: CLOUDINARY_CLOUD_NAME 环境变量未设置"
    exit 1
fi

echo "✅ 环境变量验证通过"

# 生成Prisma客户端
echo "🗄️  生成Prisma客户端..."
npx prisma generate

# 构建生产版本
echo "🔨 构建生产版本..."
npm run build

# 启动生产服务器
echo "🌟 启动生产服务器..."
echo "📍 服务运行在端口 3000"
echo "🌐 访问地址: https://$REPL_SLUG.$REPL_OWNER.repl.co"
echo "🎯 API端点: https://$REPL_SLUG.$REPL_OWNER.repl.co/api/random"
echo ""

npm start
