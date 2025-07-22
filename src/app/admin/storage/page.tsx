/**
 * 存储配置管理页面
 * 管理多图床服务配置、健康状态和故障转移
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Activity, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Database,
  Cloud,
  Zap
} from 'lucide-react';

interface StorageConfig {
  primaryProvider: string;
  backupProvider?: string;
  failoverStrategy: string;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  enableBackupUpload: boolean;
}

interface HealthStatus {
  isHealthy: boolean;
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

interface StorageStats {
  totalUploads: number;
  successRate: number;
  averageResponseTime: number;
  lastFailure?: string;
}

export default function StoragePage() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, HealthStatus>>({});
  const [stats, setStats] = useState<{
    manager: Record<string, StorageStats>;
    database: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // 加载存储信息
  const loadStorageInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/storage', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setConfig(result.data.config);
        setHealthStatus(result.data.healthStatus);
        setStats(result.data.stats);
        setError(null);
      } else {
        throw new Error(result.message || '获取存储信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 手动健康检查
  const performHealthCheck = async (provider?: string) => {
    try {
      setUpdating(true);
      const response = await fetch('/api/admin/storage/health-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setHealthStatus(result.data.results);
        setError(null);
      } else {
        throw new Error(result.message || '健康检查失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '健康检查失败');
    } finally {
      setUpdating(false);
    }
  };

  // 手动故障转移
  const triggerFailover = async (targetProvider: string) => {
    if (!confirm(`确定要切换到 ${targetProvider} 吗？`)) {
      return;
    }

    try {
      setUpdating(true);
      const response = await fetch('/api/admin/storage/failover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ 
          targetProvider,
          reason: '手动故障转移'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setConfig(result.data.config);
        setHealthStatus(result.data.healthStatus);
        setError(null);
        alert('故障转移完成');
      } else {
        throw new Error(result.message || '故障转移失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '故障转移失败');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    loadStorageInfo();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>加载存储配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">存储管理</h1>
          <p className="text-muted-foreground">管理多图床服务配置和监控</p>
        </div>
        <Button 
          onClick={() => loadStorageInfo()} 
          disabled={updating}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="health">健康状态</TabsTrigger>
          <TabsTrigger value="stats">统计信息</TabsTrigger>
          <TabsTrigger value="config">配置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 当前配置概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                当前配置
              </CardTitle>
            </CardHeader>
            <CardContent>
              {config && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">主要存储</p>
                    <div className="flex items-center mt-1">
                      <Cloud className="h-4 w-4 mr-2" />
                      <span className="font-medium">{config.primaryProvider}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">备用存储</p>
                    <div className="flex items-center mt-1">
                      <Database className="h-4 w-4 mr-2" />
                      <span className="font-medium">{config.backupProvider || '未配置'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">故障转移</p>
                    <div className="flex items-center mt-1">
                      <Zap className="h-4 w-4 mr-2" />
                      <span className="font-medium">{config.failoverStrategy}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">备份上传</p>
                    <div className="flex items-center mt-1">
                      <Badge variant={config.enableBackupUpload ? 'default' : 'secondary'}>
                        {config.enableBackupUpload ? '启用' : '禁用'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 服务状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                服务状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(healthStatus).map(([provider, status]) => (
                  <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center">
                      {status.isHealthy ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                      )}
                      <div>
                        <p className="font-medium">{provider}</p>
                        <p className="text-sm text-muted-foreground">
                          {status.responseTime ? `${status.responseTime}ms` : '响应时间未知'}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => performHealthCheck(provider)}
                        disabled={updating}
                      >
                        检查
                      </Button>
                      {provider !== config?.primaryProvider && (
                        <Button
                          size="sm"
                          onClick={() => triggerFailover(provider)}
                          disabled={updating || !status.isHealthy}
                        >
                          切换
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>健康状态详情</CardTitle>
              <CardDescription>各存储服务的详细健康信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(healthStatus).map(([provider, status]) => (
                  <div key={provider} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{provider}</h3>
                      <Badge variant={status.isHealthy ? 'default' : 'destructive'}>
                        {status.isHealthy ? '健康' : '异常'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">响应时间</p>
                        <p>{status.responseTime ? `${status.responseTime}ms` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">最后检查</p>
                        <p>{new Date(status.lastChecked).toLocaleString()}</p>
                      </div>
                    </div>
                    {status.error && (
                      <div className="mt-2">
                        <p className="text-muted-foreground text-sm">错误信息</p>
                        <p className="text-red-500 text-sm">{status.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 服务统计 */}
            <Card>
              <CardHeader>
                <CardTitle>服务统计</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.manager && Object.entries(stats.manager).map(([provider, stat]) => (
                  <div key={provider} className="mb-4 last:mb-0">
                    <h4 className="font-medium mb-2">{provider}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">总上传</p>
                        <p>{stat.totalUploads}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">成功率</p>
                        <p>{stat.successRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">平均响应</p>
                        <p>{stat.averageResponseTime.toFixed(0)}ms</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">最后失败</p>
                        <p>{stat.lastFailure ? new Date(stat.lastFailure).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 数据库统计 */}
            <Card>
              <CardHeader>
                <CardTitle>数据库统计</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.database && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-muted-foreground">总图片数</p>
                      <p className="text-2xl font-bold">{stats.database.totalImages}</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">按提供商分布</h4>
                      {Object.entries(stats.database.providerStats).map(([provider, stat]: [string, any]) => (
                        <div key={provider} className="flex justify-between text-sm">
                          <span>{provider}</span>
                          <span>{stat.count} 张</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>配置管理</CardTitle>
              <CardDescription>修改存储服务配置（开发中）</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">配置编辑功能正在开发中...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
