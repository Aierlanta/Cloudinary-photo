/**
 * IP管理服务
 * 处理IP封禁、速率限制和访问总量限制
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 检查IP是否被封禁
 */
export async function isIPBanned(ip: string): Promise<boolean> {
  try {
    const bannedIP = await prisma.bannedIP.findUnique({
      where: { ip },
    });

    if (!bannedIP) {
      return false;
    }

    // 检查是否有过期时间
    if (bannedIP.expiresAt) {
      const now = new Date();
      if (now > bannedIP.expiresAt) {
        // 已过期,自动解封
        await prisma.bannedIP.delete({
          where: { ip },
        });
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to check if IP is banned:', error);
    return false;
  }
}

/**
 * 封禁IP
 */
export async function banIP(
  ip: string,
  reason?: string,
  bannedBy?: string,
  expiresAt?: Date
): Promise<void> {
  try {
    await prisma.bannedIP.upsert({
      where: { ip },
      update: {
        reason,
        bannedBy,
        expiresAt,
        bannedAt: new Date(),
      },
      create: {
        ip,
        reason,
        bannedBy,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Failed to ban IP:', error);
    throw error;
  }
}

/**
 * 解封IP
 */
export async function unbanIP(ip: string): Promise<void> {
  try {
    await prisma.bannedIP.delete({
      where: { ip },
    });
  } catch (error) {
    console.error('Failed to unban IP:', error);
    throw error;
  }
}

/**
 * 获取所有被封禁的IP
 */
export async function getBannedIPs() {
  try {
    const bannedIPs = await prisma.bannedIP.findMany({
      orderBy: { bannedAt: 'desc' },
    });

    // 过滤掉已过期的
    const now = new Date();
    const validBannedIPs = bannedIPs.filter(
      (banned) => !banned.expiresAt || banned.expiresAt > now
    );

    return validBannedIPs;
  } catch (error) {
    console.error('Failed to get banned IPs:', error);
    throw error;
  }
}

/**
 * 设置IP的自定义速率限制
 */
export async function setIPRateLimit(
  ip: string,
  maxRequests: number,
  windowMs: number,
  maxTotal?: number
): Promise<void> {
  try {
    await prisma.iPRateLimit.upsert({
      where: { ip },
      update: {
        maxRequests,
        windowMs,
        maxTotal,
      },
      create: {
        ip,
        maxRequests,
        windowMs,
        maxTotal,
      },
    });
  } catch (error) {
    console.error('Failed to set IP rate limit:', error);
    throw error;
  }
}

/**
 * 获取IP的自定义速率限制
 */
export async function getIPRateLimit(ip: string) {
  try {
    return await prisma.iPRateLimit.findUnique({
      where: { ip },
    });
  } catch (error) {
    console.error('Failed to get IP rate limit:', error);
    return null;
  }
}

/**
 * 删除IP的自定义速率限制
 */
export async function removeIPRateLimit(ip: string): Promise<void> {
  try {
    await prisma.iPRateLimit.delete({
      where: { ip },
    });
  } catch (error) {
    console.error('Failed to remove IP rate limit:', error);
    throw error;
  }
}

/**
 * 获取所有自定义速率限制
 */
export async function getAllIPRateLimits() {
  try {
    return await prisma.iPRateLimit.findMany({
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Failed to get all IP rate limits:', error);
    throw error;
  }
}

/**
 * 检查IP是否超过总访问量限制
 */
export async function checkIPTotalLimit(ip: string): Promise<{
  exceeded: boolean;
  current: number;
  limit?: number;
}> {
  try {
    // 获取IP的自定义限制
    const rateLimit = await getIPRateLimit(ip);
    
    if (!rateLimit || !rateLimit.maxTotal) {
      return { exceeded: false, current: 0 };
    }

    // 统计该IP的总访问次数
    const totalAccess = await prisma.accessLog.count({
      where: { ip },
    });

    return {
      exceeded: totalAccess >= rateLimit.maxTotal,
      current: totalAccess,
      limit: rateLimit.maxTotal,
    };
  } catch (error) {
    console.error('Failed to check IP total limit:', error);
    return { exceeded: false, current: 0 };
  }
}

/**
 * 获取IP的访问统计
 */
export async function getIPStats(ip: string) {
  try {
    const [totalAccess, last24Hours, rateLimit, isBanned] = await Promise.all([
      prisma.accessLog.count({ where: { ip } }),
      prisma.accessLog.count({
        where: {
          ip,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      getIPRateLimit(ip),
      isIPBanned(ip),
    ]);

    return {
      ip,
      totalAccess,
      last24Hours,
      rateLimit,
      isBanned,
    };
  } catch (error) {
    console.error('Failed to get IP stats:', error);
    throw error;
  }
}

/**
 * 批量封禁IP
 */
export async function banMultipleIPs(
  ips: string[],
  reason?: string,
  bannedBy?: string,
  expiresAt?: Date
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const ip of ips) {
    try {
      await banIP(ip, reason, bannedBy, expiresAt);
      success++;
    } catch (error) {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * 清理过期的封禁记录
 */
export async function cleanupExpiredBans(): Promise<number> {
  try {
    const result = await prisma.bannedIP.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Failed to cleanup expired bans:', error);
    throw error;
  }
}

