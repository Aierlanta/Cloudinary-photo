'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Globe2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface IPLocationInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  isp?: string;
  status: 'success' | 'fail' | 'private';
  message?: string;
}

// 全局缓存，组件间共享
const globalLocationCache = new Map<string, IPLocationInfo>();

// 格式化位置显示
function formatLocation(location: IPLocationInfo): string {
  if (location.status === 'private') {
    return '本地/内网';
  }
  
  if (location.status === 'fail') {
    return '未知';
  }

  const parts: string[] = [];
  
  if (location.country) {
    parts.push(location.country);
  }
  
  if (location.city && location.city !== location.country) {
    parts.push(location.city);
  } else if (location.region && location.region !== location.country) {
    parts.push(location.region);
  }

  return parts.join(' · ') || '未知';
}

// 获取国旗 emoji
function getCountryFlag(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  
  // 将国家代码转换为国旗 emoji
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

interface IPLocationBadgeProps {
  ip: string;
  className?: string;
  showFlag?: boolean;
  compact?: boolean;
}

/**
 * IP地域显示徽章组件
 * 用于在IP地址旁边显示地理位置信息
 */
export function IPLocationBadge({ 
  ip, 
  className,
  showFlag = true,
  compact = false,
}: IPLocationBadgeProps) {
  const isLight = useTheme();
  const [location, setLocation] = useState<IPLocationInfo | null>(() => 
    globalLocationCache.get(ip) || null
  );
  const [loading, setLoading] = useState(!globalLocationCache.has(ip));
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // 如果已经有缓存，直接使用
    if (globalLocationCache.has(ip)) {
      setLocation(globalLocationCache.get(ip)!);
      setLoading(false);
      return;
    }

    // 防止对同一个 IP 重复请求
    if (fetchedRef.current === ip) return;
    fetchedRef.current = ip;

    setLoading(true);

    const fetchLocation = async () => {
      try {
        const response = await fetch(`/api/admin/security/ip-location?ip=${encodeURIComponent(ip)}`, {
          credentials: 'include', // 发送认证 cookie
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.location) {
            globalLocationCache.set(ip, data.data.location);
            setLocation(data.data.location);
          }
        }
      } catch (error) {
        console.error('Failed to fetch IP location:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [ip]);

  if (loading) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-xs",
        isLight ? "text-gray-400" : "text-gray-500",
        className
      )}>
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    );
  }

  if (!location) {
    return null;
  }

  const locationText = formatLocation(location);
  const flag = showFlag ? getCountryFlag(location.countryCode) : null;

  if (compact) {
    return (
      <span 
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          isLight ? "text-gray-500" : "text-gray-400",
          className
        )}
        title={`${location.country || ''} ${location.region || ''} ${location.city || ''} ${location.isp || ''}`.trim()}
      >
        {flag && <span>{flag}</span>}
        <span>{locationText}</span>
      </span>
    );
  }

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs",
        location.status === 'private' 
          ? isLight ? "bg-gray-100 text-gray-600" : "bg-gray-700 text-gray-300"
          : location.status === 'success'
            ? isLight ? "bg-blue-50 text-blue-700" : "bg-blue-900/30 text-blue-300"
            : isLight ? "bg-gray-100 text-gray-500" : "bg-gray-700 text-gray-400",
        className
      )}
      title={`${location.country || ''} ${location.region || ''} ${location.city || ''} ${location.isp || ''}`.trim()}
    >
      {flag && <span>{flag}</span>}
      <span>{locationText}</span>
    </span>
  );
}

interface IPWithLocationProps {
  ip: string;
  className?: string;
  ipClassName?: string;
  locationClassName?: string;
}

/**
 * IP地址+地域组合显示组件
 * 在同一行显示IP地址和地域信息
 */
export function IPWithLocation({ 
  ip, 
  className,
  ipClassName,
  locationClassName,
}: IPWithLocationProps) {
  const isLight = useTheme();

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span className={cn(
        "font-mono text-sm",
        isLight ? "text-gray-900" : "text-gray-100",
        ipClassName
      )}>
        {ip}
      </span>
      <IPLocationBadge 
        ip={ip} 
        className={locationClassName}
        compact
      />
    </div>
  );
}

interface BatchIPLocationProviderProps {
  ips: string[];
  children: (locations: Map<string, IPLocationInfo>, loading: boolean) => React.ReactNode;
}

/**
 * 批量IP地域查询Provider
 * 一次性查询多个IP的地域信息，减少API调用
 */
export function BatchIPLocationProvider({ ips, children }: BatchIPLocationProviderProps) {
  const [locations, setLocations] = useState<Map<string, IPLocationInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  // 使用 ips 的序列化字符串作为 key 来追踪变化
  const prevIpsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (ips.length === 0) {
      setLocations(new Map());
      setLoading(false);
      return;
    }

    // 生成当前 ips 的唯一 key
    const ipsKey = ips.slice().sort().join(',');
    
    // 如果 ips 没有变化，跳过
    if (prevIpsKeyRef.current === ipsKey) {
      return;
    }

    // 过滤出未缓存的IP
    const uncachedIPs = ips.filter(ip => !globalLocationCache.has(ip));
    
    // 如果所有IP都已缓存
    if (uncachedIPs.length === 0) {
      const cachedLocations = new Map<string, IPLocationInfo>();
      ips.forEach(ip => {
        const cached = globalLocationCache.get(ip);
        if (cached) {
          cachedLocations.set(ip, cached);
        }
      });
      setLocations(cachedLocations);
      setLoading(false);
      prevIpsKeyRef.current = ipsKey;
      return;
    }

    // 更新 ref，标记当前 ips 正在处理
    prevIpsKeyRef.current = ipsKey;
    setLoading(true);

    const fetchLocations = async () => {
      try {
        const response = await fetch(
          `/api/admin/security/ip-location?ips=${encodeURIComponent(uncachedIPs.join(','))}`,
          {
            credentials: 'include', // 发送认证 cookie
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.locations) {
            // 更新全局缓存
            Object.entries(data.data.locations).forEach(([ip, loc]) => {
              globalLocationCache.set(ip, loc as IPLocationInfo);
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch batch IP locations:', error);
      } finally {
        // 从全局缓存构建当前locations
        const newLocations = new Map<string, IPLocationInfo>();
        ips.forEach(ip => {
          const cached = globalLocationCache.get(ip);
          if (cached) {
            newLocations.set(ip, cached);
          }
        });
        setLocations(newLocations);
        setLoading(false);
      }
    };

    fetchLocations();
  }, [ips]);

  return <>{children(locations, loading)}</>;
}

// 导出工具函数
export { formatLocation, getCountryFlag };

// 清除缓存的工具函数（如果需要）
export function clearLocationCache() {
  globalLocationCache.clear();
}


