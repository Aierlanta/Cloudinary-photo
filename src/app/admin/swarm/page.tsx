"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Database, Network, RefreshCw, Save } from "lucide-react";
import { useAdminApi } from "@/lib/admin-api-client";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type UploadStrategy = "manual" | "round-robin" | "random" | "available-first";
type ProviderDeliveryMode = "owner-node" | "existing-chain";
type SwarmProvider = "cloudinary" | "tgstate" | "telegram" | "custom";

interface SwarmConfig {
  id: string;
  uploadStrategy: UploadStrategy;
  providerDeliveryPolicy: Record<SwarmProvider, {
    mode: ProviderDeliveryMode;
    warnOnDisable?: boolean;
  }>;
  previewDeliveryEnabled: boolean;
  cloudinaryNodeDeliveryRequired: boolean;
  updatedAt: string;
}

const providerLabels: Array<[SwarmProvider, string]> = [
  ["cloudinary", "Cloudinary"],
  ["tgstate", "tgState"],
  ["telegram", "Telegram"],
  ["custom", "Custom"],
];

function getDefaultSwarmConfig(): SwarmConfig {
  return {
    id: "default",
    uploadStrategy: "manual",
    providerDeliveryPolicy: {
      cloudinary: { mode: "owner-node", warnOnDisable: true },
      tgstate: { mode: "existing-chain" },
      telegram: { mode: "existing-chain" },
      custom: { mode: "existing-chain" },
    },
    previewDeliveryEnabled: true,
    cloudinaryNodeDeliveryRequired: true,
    updatedAt: new Date().toISOString(),
  };
}

export default function SwarmPage() {
  const isLight = useTheme();
  const {
    adminFetch,
    nodes,
    nodeStatuses,
    refreshNodeStatuses,
  } = useAdminApi();
  const { toasts, success, error: showError, removeToast } = useToast();
  const [swarmConfig, setSwarmConfig] = useState<SwarmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSwarmConfig = useCallback(async () => {
    try {
      const response = await adminFetch("/api/admin/swarm/config");
      if (response.ok) {
        const data = await response.json();
        setSwarmConfig(data.data?.config || getDefaultSwarmConfig());
      } else {
        setSwarmConfig(getDefaultSwarmConfig());
      }
    } catch (error) {
      console.error("加载蜂群配置失败:", error);
      setSwarmConfig(getDefaultSwarmConfig());
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    loadSwarmConfig();
    refreshNodeStatuses().catch(() => {});
  }, [loadSwarmConfig, refreshNodeStatuses]);

  const saveSwarmConfig = async () => {
    if (!swarmConfig) return;
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/swarm/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uploadStrategy: swarmConfig.uploadStrategy,
          providerDeliveryPolicy: swarmConfig.providerDeliveryPolicy,
          previewDeliveryEnabled: swarmConfig.previewDeliveryEnabled,
          cloudinaryNodeDeliveryRequired: swarmConfig.cloudinaryNodeDeliveryRequired,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || "蜂群配置保存失败");
      }

      const data = await response.json();
      setSwarmConfig(data.data?.config || swarmConfig);
      success("蜂群配置已保存", "共享策略已写入数据库。");
    } catch (error) {
      showError("蜂群配置保存失败", error instanceof Error ? error.message : "网络错误");
    } finally {
      setSaving(false);
    }
  };

  const updateProviderDeliveryMode = (provider: SwarmProvider, mode: ProviderDeliveryMode) => {
    if (!swarmConfig) return;
    setSwarmConfig({
      ...swarmConfig,
      providerDeliveryPolicy: {
        ...swarmConfig.providerDeliveryPolicy,
        [provider]: {
          ...swarmConfig.providerDeliveryPolicy[provider],
          mode,
        },
      },
    });
  };

  if (loading || !swarmConfig) {
    return (
      <div className={cn(
        "border p-6 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <p className={cn(isLight ? "text-gray-600" : "text-gray-400")}>加载蜂群配置中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto rounded-lg">
      <div className={cn(
        "border p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 flex items-center justify-center rounded-lg",
            isLight ? "bg-blue-500" : "bg-blue-600"
          )}>
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={cn("text-3xl font-bold mb-2", isLight ? "text-gray-900" : "text-gray-100")}>
              蜂群
            </h1>
            <p className={cn("text-sm", isLight ? "text-gray-600" : "text-gray-400")}>
              管理多节点状态、默认上传策略和 provider 交付策略。节点身份与密钥仍由 env 管理。
            </p>
          </div>
        </div>
        <button
          onClick={saveSwarmConfig}
          disabled={saving}
          className={cn(
            "px-4 py-2 border flex items-center gap-2 transition-colors disabled:opacity-50 rounded-lg",
            isLight
              ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
              : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
          )}
        >
          <Save className="w-4 h-4" />
          {saving ? "保存中..." : "保存蜂群配置"}
        </button>
      </div>

      <div className={cn(
        "border p-6 space-y-4 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Database className={cn("w-5 h-5", isLight ? "text-blue-500" : "text-blue-400")} />
            <div>
              <h2 className={cn("font-bold text-lg", isLight ? "text-gray-900" : "text-gray-100")}>
                节点总览
              </h2>
              <p className={cn("text-sm", isLight ? "text-gray-600" : "text-gray-400")}>
                节点列表来自 env，健康状态通过各节点 `/api/status` 探测。
              </p>
            </div>
          </div>
          <button
            onClick={() => refreshNodeStatuses().catch(() => {})}
            className={cn(
              "px-3 py-2 border flex items-center gap-2 rounded-lg",
              isLight ? "bg-gray-50 border-gray-300 hover:bg-gray-100" : "bg-gray-700 border-gray-600 hover:bg-gray-600"
            )}
          >
            <RefreshCw className="w-4 h-4" />
            刷新状态
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {nodes.map((node) => {
            const status = nodeStatuses[node.id];
            const statusLabel = status?.status === "online"
              ? "在线"
              : status?.status === "degraded"
                ? "降级"
                : status?.status === "offline"
                  ? "离线"
                  : "未知";
            const statusClass = status?.status === "online"
              ? "bg-green-500"
              : status?.status === "degraded"
                ? "bg-yellow-500"
                : status?.status === "offline"
                  ? "bg-red-500"
                  : "bg-gray-400";

            return (
              <div
                key={node.id}
                className={cn(
                  "border p-4 rounded-lg",
                  isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", statusClass)} />
                  <span className={cn("font-medium", isLight ? "text-gray-900" : "text-gray-100")}>{node.name}</span>
                  <span className={cn("text-xs", isLight ? "text-gray-500" : "text-gray-400")}>({statusLabel})</span>
                </div>
                <p className={cn("mt-2 text-xs break-all", isLight ? "text-gray-500" : "text-gray-400")}>{node.baseUrl}</p>
                <p className={cn("mt-1 text-xs", isLight ? "text-gray-500" : "text-gray-400")}>
                  {status?.latencyMs !== undefined ? `${status.latencyMs}ms` : "未探测"}
                  {status?.version ? ` · v${status.version}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn(
        "border p-6 space-y-4 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="flex items-center gap-3">
          <Database className={cn("w-5 h-5", isLight ? "text-blue-500" : "text-blue-400")} />
          <div>
            <h2 className={cn("font-bold text-lg", isLight ? "text-gray-900" : "text-gray-100")}>
              共享策略
            </h2>
            <p className={cn("text-sm", isLight ? "text-gray-600" : "text-gray-400")}>
              这些设置保存到共享数据库，同一蜂群内所有前端/节点保持一致。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg">
          <div className="space-y-2">
            <label className={cn("block text-sm font-medium", isLight ? "text-gray-700" : "text-gray-300")}>
              默认上传策略
            </label>
            <select
              value={swarmConfig.uploadStrategy}
              onChange={(event) => setSwarmConfig({ ...swarmConfig, uploadStrategy: event.target.value as UploadStrategy })}
              className={cn(
                "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-700 border-gray-600"
              )}
            >
              <option value="manual">手动选择目标节点</option>
              <option value="round-robin">轮询分散到可用节点</option>
              <option value="random">随机选择可用节点</option>
              <option value="available-first">优先选择第一个可用节点</option>
            </select>
          </div>

          <label className={cn(
            "flex items-center justify-between gap-4 p-3 border rounded-lg",
            isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
          )}>
            <div>
              <p className={cn("font-medium text-sm", isLight ? "text-gray-900" : "text-gray-100")}>
                管理端预览图策略化交付
              </p>
              <p className={cn("text-xs mt-1", isLight ? "text-gray-600" : "text-gray-400")}>
                开启后按 provider 策略生成预览 URL。
              </p>
            </div>
            <input
              type="checkbox"
              checked={swarmConfig.previewDeliveryEnabled}
              onChange={(event) => setSwarmConfig({ ...swarmConfig, previewDeliveryEnabled: event.target.checked })}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg">
          {providerLabels.map(([provider, label]) => (
            <div
              key={provider}
              className={cn(
                "border p-3 rounded-lg",
                isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={cn("font-medium text-sm", isLight ? "text-gray-900" : "text-gray-100")}>
                    {label}
                  </p>
                  <p className={cn("text-xs mt-1", isLight ? "text-gray-600" : "text-gray-400")}>
                    {swarmConfig.providerDeliveryPolicy[provider]?.mode === "owner-node"
                      ? "走 owner 节点交付链路"
                      : "沿用现有直链/代理链路"}
                  </p>
                </div>
                <select
                  value={swarmConfig.providerDeliveryPolicy[provider]?.mode || "existing-chain"}
                  onChange={(event) => updateProviderDeliveryMode(provider, event.target.value as ProviderDeliveryMode)}
                  className={cn(
                    "px-2 py-1 border text-xs outline-none rounded-lg",
                    isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
                  )}
                >
                  <option value="owner-node">owner 节点</option>
                  <option value="existing-chain">现有链路</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {swarmConfig.providerDeliveryPolicy.cloudinary.mode !== "owner-node" && (
          <div className={cn(
            "flex items-start gap-3 p-3 border rounded-lg",
            isLight
              ? "bg-yellow-50 border-yellow-300 text-yellow-800"
              : "bg-yellow-900/20 border-yellow-700 text-yellow-200"
          )}>
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">
              Cloudinary 未走 owner 节点交付可能暴露前端来源、管理端域名和访问模式，增加 provider 风控风险。除非你明确接受该风险，否则建议保持开启。
            </p>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}
