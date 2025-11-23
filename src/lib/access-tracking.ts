/**
 * 访问统计追踪服务
 * 记录API访问日志,用于统计和分析
 */

import { prisma } from './prisma';
import { NextRequest } from 'next/server';

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

/**
 * 规范化路径，移除 t 参数（时间戳参数，用于缓存破坏）
 */
function normalizePath(path: string): string {
  try {
    const url = new URL(path, 'http://localhost');
    // 移除 t 参数
    url.searchParams.delete('t');
    // 重新构建路径，保留其他参数
    const normalizedPath = url.pathname + (url.search ? url.search : '');
    return normalizedPath;
  } catch {
    // 如果解析失败，尝试手动处理
    const [pathname, search] = path.split('?');
    if (!search) return pathname;
    
    const params = new URLSearchParams(search);
    params.delete('t');
    const newSearch = params.toString();
    return pathname + (newSearch ? '?' + newSearch : '');
  }
}

interface AccessStatsOptions {
  days?: number;
  hours?: number;
}

/**
 * 获取客户端IP地址
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

/**
 * 记录访问日志
 */
export async function logAccess(
  ip: string,
  path: string,
  method: string,
  userAgent: string | null,
  statusCode?: number,
  responseTime?: number
): Promise<void> {
  const normalizedPath = normalizePath(path);

  try {
    // 记录访问日志
    await prisma.accessLog.create({
      data: {
        ip,
        path: normalizedPath,
        method,
        userAgent,
        statusCode,
        responseTime,
      },
    });

    // 增加IP总访问计数(异步执行,不阻塞主流程)
    // 动态导入避免循环依赖
    const { incrementIPTotalAccess } = await import('./ip-management');
    incrementIPTotalAccess(ip).catch(console.error);
  } catch (error) {
    // 记录失败不应该影响主流程
    console.error('Failed to log access:', error);
  }
}

/**
 * 获取访问统计概览
 */
export async function getAccessStats(options: AccessStatsOptions = {}) {
  const { days, hours } = options;
  const effectiveHours = typeof hours === 'number' && hours > 0 ? hours : undefined;
  const effectiveDays = typeof days === 'number' && days > 0 ? days : 7;
  const startTimestamp = effectiveHours
    ? Date.now() - effectiveHours * HOUR_IN_MS
    : Date.now() - effectiveDays * DAY_IN_MS;
  const startDate = new Date(startTimestamp);

  try {
    // 总访问量
    const totalAccess = await prisma.accessLog.count({
      where: {
        timestamp: {
          gte: startDate,
        },
      },
    });

    // 唯一IP数
    const uniqueIPs = await prisma.accessLog.groupBy({
      by: ['ip'],
      where: {
        timestamp: {
          gte: startDate,
        },
      },
      _count: true,
    });

    // 按路径统计 - 只统计 /api/random 和 /api/response 路径，保留参数
    const allPathStats = await prisma.accessLog.groupBy({
      by: ['path'],
      where: {
        timestamp: {
          gte: startDate,
        },
      },
      _count: true,
      orderBy: {
        _count: {
          path: 'desc',
        },
      },
    });

    // 过滤出只包含 /api/random 和 /api/response 的路径（保留参数，但移除 t 参数）
    const filteredPathStats = allPathStats
      .filter(stat => {
        const path = stat.path;
        return path.startsWith('/api/random') || path.startsWith('/api/response');
      });

    // 规范化路径（移除 t 参数）并重新聚合
    const normalizedPathMap = new Map<string, number>();
    for (const stat of filteredPathStats) {
      const normalizedPath = normalizePath(stat.path);
      const currentCount = normalizedPathMap.get(normalizedPath) || 0;
      const statCount =
        typeof stat._count === 'number'
          ? stat._count
          : (stat as any)._count?._all ?? (stat as any)._count?.path ?? 0;
      normalizedPathMap.set(normalizedPath, currentCount + statCount);
    }

    // 转换为数组并按计数排序
    const normalizedPathStats = Array.from(normalizedPathMap.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // 只取前10个

    // 按日期统计
    const dailyStats = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM access_logs
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;

    // Top访问IP
    const topIPs = await prisma.accessLog.groupBy({
      by: ['ip'],
      where: {
        timestamp: {
          gte: startDate,
        },
      },
      _count: true,
      orderBy: {
        _count: {
          ip: 'desc',
        },
      },
      take: 10,
    });

    return {
      totalAccess,
      uniqueIPCount: uniqueIPs.length,
      pathStats: normalizedPathStats,
      dailyStats: dailyStats.map(stat => ({
        date: stat.date,
        count: Number(stat.count),
      })),
      topIPs: topIPs.map(stat => ({
        ip: stat.ip,
        count: stat._count,
      })),
    };
  } catch (error) {
    console.error('Failed to get access stats:', error);
    throw error;
  }
}

/**
 * 获取特定IP的访问记录
 */
export async function getIPAccessHistory(
  ip: string,
  limit: number = 100
) {
  try {
    const records = await prisma.accessLog.findMany({
      where: { ip },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const totalCount = await prisma.accessLog.count({
      where: { ip },
    });

    return {
      records,
      totalCount,
    };
  } catch (error) {
    console.error('Failed to get IP access history:', error);
    throw error;
  }
}

/**
 * 清理旧的访问日志
 */
export async function cleanupOldAccessLogs(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    const result = await prisma.accessLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Failed to cleanup old access logs:', error);
    throw error;
  }
}

/**
 * 获取实时访问统计
 */
export async function getRealtimeStats() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [lastHourCount, last24HoursCount, totalCount] = await Promise.all([
      prisma.accessLog.count({
        where: {
          timestamp: {
            gte: oneHourAgo,
          },
        },
      }),
      prisma.accessLog.count({
        where: {
          timestamp: {
            gte: oneDayAgo,
          },
        },
      }),
      prisma.accessLog.count(),
    ]);

    return {
      lastHour: lastHourCount,
      last24Hours: last24HoursCount,
      total: totalCount,
    };
  } catch (error) {
    console.error('Failed to get realtime stats:', error);
    throw error;
  }
}
