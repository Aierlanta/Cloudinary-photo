#!/bin/bash

# 随机图片API服务 - 快速启动脚本
# 参考成功项目的启动模式

set -e

echo "=== 随机图片API服务 - 快速启动 ==="
echo "开始时间: $(date)"

# 设置环境变量（关键：HOSTNAME必须设置为0.0.0.0）
export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT=3000

# 确保构建目录存在
if [ ! -d ".next" ]; then
    echo "❌ 错误：.next目录不存在，请先运行构建命令"
    exit 1
fi

# 启动服务器
echo "🚀 启动Next.js服务器..."
echo "端口: $PORT"
echo "主机: $HOSTNAME"
echo "环境: $NODE_ENV"

# 使用next start启动服务器（参考成功项目的方式）
HOSTNAME=$HOSTNAME PORT=$PORT npm run start
