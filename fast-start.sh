#!/bin/bash

# 随机图片API服务 - Replit快速启动脚本
echo "🚀 启动随机图片API服务..."

# 检查Node.js版本
echo "📋 检查Node.js版本..."
node --version
npm --version

# 安装依赖
echo "📦 安装项目依赖..."
npm install --legacy-peer-deps

# 检查环境变量
echo "🔧 检查环境变量..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  警告: DATABASE_URL 环境变量未设置"
fi

if [ -z "$CLOUDINARY_CLOUD_NAME" ]; then
    echo "⚠️  警告: CLOUDINARY_CLOUD_NAME 环境变量未设置"
fi

# 数据库初始化（如果需要）
echo "🗄️  初始化数据库..."
if [ ! -z "$DATABASE_URL" ]; then
    npx prisma generate
    npx prisma db push --accept-data-loss
else
    echo "⚠️  跳过数据库初始化（DATABASE_URL未设置）"
fi

# 构建项目
echo "🔨 构建项目..."
npm run build

# 启动服务
echo "🌟 启动服务器..."
echo "📍 服务将在端口 3000 启动"
echo "🌐 访问地址: https://$REPL_SLUG.$REPL_OWNER.repl.co"
echo ""

npm start
