#!/bin/bash

# 随机图片API服务 - 生产环境快速启动脚本
echo "🚀 启动随机图片API生产服务..."

# 快速环境检查（仅检查关键变量）
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误: DATABASE_URL 环境变量未设置"
    exit 1
fi

if [ -z "$CLOUDINARY_CLOUD_NAME" ]; then
    echo "❌ 错误: CLOUDINARY_CLOUD_NAME 环境变量未设置"
    exit 1
fi

echo "✅ 环境变量验证通过"

# 启动生产服务器（假设构建已完成）
echo "🌟 启动生产服务器..."
echo "📍 服务运行在端口 3000"
echo "🌐 访问地址: https://$REPL_SLUG.$REPL_OWNER.repl.co"
echo "🎯 API端点: https://$REPL_SLUG.$REPL_OWNER.repl.co/api/random"
echo ""

# 直接启动，不进行额外的构建操作
npm start
