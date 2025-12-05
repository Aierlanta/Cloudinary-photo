/**
 * IP地理位置查询API端点
 * GET /api/admin/security/ip-location?ip=xxx - 获取IP地理位置信息
 * GET /api/admin/security/ip-location?ips=ip1,ip2,ip3 - 批量获取多个IP地理位置
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { withErrorHandler } from '@/lib/error-handler';
import { APIResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

// IP地理位置信息接口
export interface IPLocationInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  isp?: string;
  status: 'success' | 'fail' | 'private';
  message?: string;
}

// 内存缓存 IP 地理位置信息
const locationCache = new Map<string, { data: IPLocationInfo; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

// 检查是否是私有/保留IP
function isPrivateIP(ip: string): boolean {
  // 私有IP范围
  const privateRanges = [
    /^10\./,                          // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./,                    // 192.168.0.0 - 192.168.255.255
    /^127\./,                         // 127.0.0.0 - 127.255.255.255 (loopback)
    /^169\.254\./,                    // 169.254.0.0 - 169.254.255.255 (link-local)
    /^::1$/,                          // IPv6 loopback
    /^fc00:/i,                        // IPv6 unique local
    /^fe80:/i,                        // IPv6 link-local
  ];
  
  return privateRanges.some(range => range.test(ip)) || ip === 'unknown' || ip === 'localhost';
}

// 查询单个IP地理位置
async function queryIPLocation(ip: string): Promise<IPLocationInfo> {
  // 检查缓存
  const cached = locationCache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 检查是否是私有IP
  if (isPrivateIP(ip)) {
    const result: IPLocationInfo = {
      ip,
      status: 'private',
      message: 'Private/Reserved IP',
    };
    locationCache.set(ip, { data: result, timestamp: Date.now() });
    return result;
  }

  try {
    // 使用 ip-api.com 免费服务
    // 注意：免费版本限制 45 requests/minute
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,isp`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    const result: IPLocationInfo = {
      ip,
      status: data.status === 'success' ? 'success' : 'fail',
      message: data.message,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      isp: data.isp,
    };

    // 缓存结果
    locationCache.set(ip, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error(`Failed to query IP location for ${ip}:`, error);
    const result: IPLocationInfo = {
      ip,
      status: 'fail',
      message: error instanceof Error ? error.message : 'Query failed',
    };
    return result;
  }
}

// 批量查询IP地理位置（限制并发）
async function queryBatchIPLocation(ips: string[]): Promise<IPLocationInfo[]> {
  const uniqueIPs = [...new Set(ips)];
  const results: IPLocationInfo[] = [];
  
  // 限制并发数为5，避免超过API速率限制
  const batchSize = 5;
  for (let i = 0; i < uniqueIPs.length; i += batchSize) {
    const batch = uniqueIPs.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(ip => queryIPLocation(ip)));
    results.push(...batchResults);
    
    // 如果还有更多批次，稍微延迟避免速率限制
    if (i + batchSize < uniqueIPs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

async function getIPLocation(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const singleIP = searchParams.get('ip');
  const multipleIPs = searchParams.get('ips');

  if (!singleIP && !multipleIPs) {
    return NextResponse.json(
      {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: '请提供IP地址参数 (ip=xxx 或 ips=ip1,ip2)',
          timestamp: new Date(),
        },
      },
      { status: 400 }
    );
  }

  try {
    if (singleIP) {
      // 单个IP查询
      const location = await queryIPLocation(singleIP);
      
      const response: APIResponse<{ location: IPLocationInfo }> = {
        success: true,
        data: { location },
        timestamp: new Date(),
      };

      return NextResponse.json(response);
    } else {
      // 批量查询
      const ips = multipleIPs!.split(',').map(ip => ip.trim()).filter(Boolean);
      
      if (ips.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              message: 'IP列表为空',
              timestamp: new Date(),
            },
          },
          { status: 400 }
        );
      }

      if (ips.length > 50) {
        return NextResponse.json(
          {
            success: false,
            error: {
              type: 'VALIDATION_ERROR',
              message: '批量查询最多支持50个IP',
              timestamp: new Date(),
            },
          },
          { status: 400 }
        );
      }

      const locations = await queryBatchIPLocation(ips);
      
      // 转换为 Map 格式方便前端使用
      const locationsMap: Record<string, IPLocationInfo> = {};
      locations.forEach(loc => {
        locationsMap[loc.ip] = loc;
      });

      const response: APIResponse<{ locations: Record<string, IPLocationInfo> }> = {
        success: true,
        data: { locations: locationsMap },
        timestamp: new Date(),
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    throw error;
  }
}

export const GET = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['GET'],
    enableAccessLog: false,
  })(withAdminAuth(getIPLocation))
);
