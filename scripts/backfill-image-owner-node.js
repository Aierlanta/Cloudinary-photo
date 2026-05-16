#!/usr/bin/env node

/**
 * Backfill image ownership metadata for swarm routing.
 *
 * By default this script runs in dry-run mode. Pass --apply to update the DB.
 */

const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config();
} catch {
  console.warn('无法加载 dotenv，将使用系统环境变量');
}

const prisma = new PrismaClient();

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }

  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolveBaseUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`无效的节点 Base URL: ${value}`);
  }
}

function resolveScope(value) {
  if (value === 'all' || value === 'missing') return value;
  throw new Error(`无效的 scope: ${value}，只能是 all 或 missing`);
}

async function main() {
  const apply = hasFlag('apply');
  const nodeId = readArg('node-id', '0').trim();
  const baseUrl = resolveBaseUrl(readArg('base-url', 'http://localhost:3000').trim());
  const scope = resolveScope(readArg('scope', 'all').trim());

  if (!nodeId) {
    throw new Error('node-id 不能为空');
  }

  const missingOwnerWhere = {
    OR: [
      { ownerNodeId: null },
      { ownerNodeBaseUrl: null }
    ]
  };
  const where = scope === 'missing' ? missingOwnerWhere : {};

  const [imageCount, storageRecordCount] = await Promise.all([
    prisma.image.count({ where }),
    prisma.imageStorageRecord.count({ where })
  ]);

  console.log('图片归属节点回填');
  console.log(`目标节点: ${nodeId}`);
  console.log(`目标 Base URL: ${baseUrl}`);
  console.log(`范围: ${scope === 'all' ? '全部记录' : '仅缺失归属节点的记录'}`);
  console.log(`待更新 images: ${imageCount}`);
  console.log(`待更新 image_storage_records: ${storageRecordCount}`);

  if (!apply) {
    console.log('');
    console.log('当前为 dry-run，未修改数据库。确认无误后追加 --apply 执行。');
    return;
  }

  const [imageResult, storageRecordResult] = await prisma.$transaction([
    prisma.image.updateMany({
      where,
      data: {
        ownerNodeId: nodeId,
        ownerNodeBaseUrl: baseUrl
      }
    }),
    prisma.imageStorageRecord.updateMany({
      where,
      data: {
        ownerNodeId: nodeId,
        ownerNodeBaseUrl: baseUrl
      }
    })
  ]);

  console.log('');
  console.log('数据库已更新。');
  console.log(`已更新 images: ${imageResult.count}`);
  console.log(`已更新 image_storage_records: ${storageRecordResult.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
