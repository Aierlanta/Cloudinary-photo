"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  Image as ImageIcon, 
  Layers, 
  Settings, 
  Database, 
  Activity, 
  ShieldAlert, 
  FileText,
  HardDrive
} from 'lucide-react';

const STORAGE_KEY = 'admin_visited_routes';
const MAX_HISTORY = 10;

// 路由配置定义
export interface RouteConfig {
  icon: any;
  labelKey: string;
  descKey?: string; // 可选的描述键
  defaultLabel?: string;
  defaultDesc?: string;
  color?: string; // 颜色主题 (Tailwind class part, e.g. "blue")
}

// 路由映射配置
export const ROUTE_MAP: Record<string, RouteConfig> = {
  '/admin/images': { 
    icon: ImageIcon, 
    labelKey: 'adminDashboard.uploadImage', 
    descKey: 'adminDashboard.uploadImageDesc',
    defaultLabel: '图片管理',
    defaultDesc: '管理所有上传的图片',
    color: 'blue'
  },
  '/admin/groups': { 
    icon: Layers, 
    labelKey: 'adminDashboard.manageGroups', 
    descKey: 'adminDashboard.manageGroupsDesc',
    defaultLabel: '分组管理',
    defaultDesc: '管理图片分组',
    color: 'green'
  },
  '/admin/config': { 
    icon: Settings, 
    labelKey: 'adminDashboard.apiConfig', 
    descKey: 'adminDashboard.apiConfigDesc',
    defaultLabel: 'API配置',
    defaultDesc: '系统参数设置',
    color: 'purple'
  },
  '/admin/backup': { 
    icon: Database, 
    labelKey: 'adminDashboard.backupManagement', 
    descKey: 'adminDashboard.backupManagementDesc',
    defaultLabel: '备份管理',
    defaultDesc: '数据库备份与恢复',
    color: 'emerald'
  },
  '/admin/gallery': { 
    icon: ImageIcon, 
    labelKey: 'adminNav.gallery',
    defaultLabel: '图库',
    defaultDesc: '浏览图片库',
    color: 'indigo'
  },
  '/admin/status': { 
    icon: Activity, 
    labelKey: 'adminNav.status',
    defaultLabel: '系统状态',
    defaultDesc: '查看系统运行状态',
    color: 'orange'
  },
  '/admin/storage': { 
    icon: HardDrive, 
    labelKey: 'adminNav.storage',
    defaultLabel: '存储管理',
    defaultDesc: '管理存储空间',
    color: 'cyan'
  },
  '/admin/security': { 
    icon: ShieldAlert, 
    labelKey: 'adminNav.security',
    defaultLabel: '风控管理',
    defaultDesc: 'IP封禁与访问控制',
    color: 'red'
  },
  '/admin/logs': {
    icon: FileText,
    labelKey: 'adminNav.logs',
    defaultLabel: '日志管理',
    defaultDesc: '查看系统日志',
    color: 'slate'
  }
};

// 默认路由列表（当没有足够历史记录时使用）
export const DEFAULT_ROUTES = [
  '/admin/images',
  '/admin/groups',
  '/admin/config',
  '/admin/backup'
];

/**
 * Hook: 记录访问历史
 * 应在 AdminLayout 中调用
 */
export function useRecordAdminHistory() {
  const pathname = usePathname();

  useEffect(() => {
    // 忽略非admin路径或dashboard根路径
    if (!pathname || !pathname.startsWith('/admin') || pathname === '/admin') {
      return;
    }

    // 只记录在 ROUTE_MAP 中定义的路由，或者是已知的有效页面
    // 这里我们简单判断：只要是 /admin/ 下的路由，且不是排除列表中的
    if (Object.keys(ROUTE_MAP).includes(pathname)) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        let history: string[] = saved ? JSON.parse(saved) : [];
        
        // 移除当前路径（如果存在），然后添加到头部
        history = history.filter(p => p !== pathname);
        history.unshift(pathname);
        
        // 限制长度
        if (history.length > MAX_HISTORY) {
          history = history.slice(0, MAX_HISTORY);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch (e) {
        console.error('Failed to update admin history:', e);
      }
    }
  }, [pathname]);
}

/**
 * Hook: 获取最近访问的路由
 * @param count 返回的数量，默认为 4
 */
export function useRecentAdminRoutes(count: number = 4) {
  const [routes, setRoutes] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let history: string[] = saved ? JSON.parse(saved) : [];
      
      // 过滤掉不在 ROUTE_MAP 中的路由（防止配置更改后出现无效路由）
      history = history.filter(path => ROUTE_MAP[path]);

      // 如果历史记录不足，用默认路由填充
      const result = [...history];
      for (const defaultRoute of DEFAULT_ROUTES) {
        if (result.length >= count) break;
        if (!result.includes(defaultRoute)) {
          result.push(defaultRoute);
        }
      }
      
      setRoutes(result.slice(0, count));
    } catch (e) {
      console.error('Failed to load admin history:', e);
      setRoutes(DEFAULT_ROUTES.slice(0, count));
    } finally {
      setIsLoaded(true);
    }
  }, [count]);

  return { routes, isLoaded, routeConfig: ROUTE_MAP };
}

