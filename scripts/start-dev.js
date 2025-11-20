#!/usr/bin/env node

/**
 * 开发服务器启动脚本
 * 从环境变量读取 PORT，如果未设置则使用默认值 3000
 */

const { spawn } = require('child_process');
const path = require('path');

// 尝试加载 .env 文件
try {
  require('dotenv').config();
} catch (error) {
  console.warn('⚠️  无法加载 dotenv，将使用系统环境变量');
}

// 获取端口号，优先使用环境变量，否则使用默认值
const port = process.env.PORT || '3000';

console.log(`🚀 正在启动开发服务器，端口: ${port}`);

// 启动 Next.js 开发服务器
const child = spawn('npx', ['next', 'dev', '-p', port], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

child.on('error', (error) => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

// 处理进程终止信号
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

