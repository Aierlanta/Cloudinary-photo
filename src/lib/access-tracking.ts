/**
 * 访问统计追踪服务
 * 记录API访问日志,用于统计和分析
 */

import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

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
  try {
    await prisma.accessLog.create({
      data: {
        ip,
        path,
        method,
        userAgent,
        statusCode,
        responseTime,
      },
    });
  } catch (error) {
    // 记录失败不应该影响主流程
    console.error('Failed to log access:', error);
  }
}

/**
 * 获取访问统计概览
 */
export async function getAccessStats(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

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

    // 按路径统计
    const pathStats = await prisma.accessLog.groupBy({
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
      take: 10,
    });

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
      pathStats: pathStats.map(stat => ({
        path: stat.path,
        count: stat._count,
      })),
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

