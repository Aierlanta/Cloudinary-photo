"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getNodeDisplayName, useAdminApi } from "@/lib/admin-api-client";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import styles from "../admin-pages.module.css";

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

interface CloudinaryCreditsUsage {
  usage: number;
  limit: number;
  used_percent: number;
}

interface NodeCloudinaryUsage {
  status: "loading" | "ready" | "error";
  configured?: boolean;
  enabled?: boolean;
  cloudName?: string;
  credits?: CloudinaryCreditsUsage;
  error?: string;
}

interface CloudinaryUsageApiResponse {
  success?: boolean;
  data?: {
    cloudinary?: {
      configured?: boolean;
      status?: "enabled" | "disabled";
      cloudName?: string;
      credits?: CloudinaryCreditsUsage;
      error?: string;
    };
  };
}

const swarmProviders: SwarmProvider[] = ["cloudinary", "tgstate", "telegram", "custom"];

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

function formatCreditsNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export default function SwarmPage() {
  const { t } = useLocale();
  const {
    adminFetch,
    fetchAllNodes,
    nodes,
    nodeStatuses,
    refreshNodeStatuses,
  } = useAdminApi();
  const { toasts, success, error: showError, removeToast } = useToast();
  const [swarmConfig, setSwarmConfig] = useState<SwarmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloudinaryUsageByNode, setCloudinaryUsageByNode] = useState<Record<string, NodeCloudinaryUsage>>({});

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

  const refreshCloudinaryUsage = useCallback(async () => {
    if (nodes.length === 0) {
      setCloudinaryUsageByNode({});
      return;
    }

    setCloudinaryUsageByNode((previous) => {
      const next: Record<string, NodeCloudinaryUsage> = {};
      for (const node of nodes) {
        next[node.id] = previous[node.id]?.status === "ready"
          ? previous[node.id]
          : { status: "loading" };
      }
      return next;
    });

    const results = await fetchAllNodes<CloudinaryUsageApiResponse>("/api/status?mode=cloudinary");
    const nextUsage: Record<string, NodeCloudinaryUsage> = {};

    for (const result of results) {
      if (!result.ok || !result.data?.success || !result.data.data?.cloudinary) {
        nextUsage[result.node.id] = {
          status: "error",
          error: result.error || t.adminUi.cloudinaryUsageFailed,
        };
        continue;
      }

      const cloudinary = result.data.data.cloudinary;
      nextUsage[result.node.id] = {
        status: "ready",
        configured: Boolean(cloudinary.configured),
        enabled: cloudinary.status === "enabled",
        cloudName: cloudinary.cloudName,
        credits: cloudinary.credits,
        error: cloudinary.error,
      };
    }

    setCloudinaryUsageByNode(nextUsage);
  }, [fetchAllNodes, nodes, t.adminUi.cloudinaryUsageFailed]);

  const refreshSwarmNodeViews = useCallback(async () => {
    await Promise.all([
      refreshNodeStatuses().catch(() => {}),
      refreshCloudinaryUsage().catch(() => {}),
    ]);
  }, [refreshCloudinaryUsage, refreshNodeStatuses]);

  useEffect(() => {
    loadSwarmConfig();
    refreshSwarmNodeViews().catch(() => {});
  }, [loadSwarmConfig, refreshSwarmNodeViews]);

  const saveSwarmConfig = async () => {
    if (!swarmConfig) return;
    setSaving(true);
    try {
      const response = await adminFetch("/api/admin/swarm/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadStrategy: swarmConfig.uploadStrategy,
          providerDeliveryPolicy: swarmConfig.providerDeliveryPolicy,
          previewDeliveryEnabled: swarmConfig.previewDeliveryEnabled,
          cloudinaryNodeDeliveryRequired: swarmConfig.cloudinaryNodeDeliveryRequired,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || t.adminUi.swarmConfigSaveFailed);
      }

      const data = await response.json();
      setSwarmConfig(data.data?.config || swarmConfig);
      success(t.adminUi.swarmConfigSaved, t.adminUi.swarmConfigSavedHint);
    } catch (error) {
      showError(t.adminUi.swarmConfigSaveFailed, error instanceof Error ? error.message : t.adminLogin.networkError);
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

  const statusCounts = useMemo(() => {
    const counts = { online: 0, degraded: 0, offline: 0, unknown: 0 };
    nodes.forEach((node) => {
      const status = nodeStatuses[node.id]?.status;
      if (status === "online") counts.online += 1;
      else if (status === "degraded") counts.degraded += 1;
      else if (status === "offline") counts.offline += 1;
      else counts.unknown += 1;
    });
    return counts;
  }, [nodes, nodeStatuses]);

  if (loading || !swarmConfig) {
    return (
      <div className={`${styles.page} admin-swarm-page`}>
        <div className={styles.panel}>
          <div className={styles.empty}>{t.adminUi.swarmConfigLoading}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} admin-swarm-page`}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminNav.swarm}</span>
            <span style={{ color: "var(--secondary)" }}> {t.adminUi.nodes}</span>
            <span className="admin-swarm-artwork admin-swarm-artworkHero" aria-hidden="true" />
          </h1>
          <p className={styles.heroSubtitle}>
            {t.adminUi.swarmSubtitle}
          </p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={() => refreshSwarmNodeViews().catch(() => {})}
            className={cn(styles.btn, styles.btnLavender)}
          >
            <span className="admin-swarm-action-artwork swarmActionRefresh" aria-hidden="true" />
            {t.common.refresh}
          </button>
          <button
            type="button"
            onClick={saveSwarmConfig}
            disabled={saving}
            className={cn(styles.btn, styles.btnPink)}
          >
            <span className="admin-swarm-action-artwork swarmActionSave" aria-hidden="true" />
            {saving ? t.adminConfig.saving : t.adminUi.saveSwarmConfig}
          </button>
        </div>
      </header>

      <section className={styles.statGrid} aria-label={t.adminUi.nodeStatusSummary}>
        <article className={cn(styles.statCard, styles.toneMint)}>
          <p className={styles.statLabel}>{t.adminUi.totalNodes}</p>
          <p className={styles.statValue}>{nodes.length}</p>
          <span className={cn(styles.statIcon, "admin-swarm-action-artwork swarmActionNetwork")} aria-hidden="true" />
        </article>
        <article className={cn(styles.statCard, styles.toneLavender)}>
          <p className={styles.statLabel}>{t.adminUi.online}</p>
          <p className={styles.statValue}>{statusCounts.online}</p>
          <span className={cn(styles.statIcon, "admin-swarm-action-artwork swarmActionDatabase")} aria-hidden="true" />
        </article>
        <article className={cn(styles.statCard, styles.toneAmber)}>
          <p className={styles.statLabel}>{t.adminUi.degraded}</p>
          <p className={styles.statValue}>{statusCounts.degraded}</p>
          <span className={cn(styles.statIcon, "admin-swarm-action-artwork swarmActionWarning")} aria-hidden="true" />
        </article>
        <article className={cn(styles.statCard, styles.tonePink)}>
          <p className={styles.statLabel}>{t.adminUi.offline}</p>
          <p className={styles.statValue}>{statusCounts.offline}</p>
          <span className={cn(styles.statIcon, "admin-swarm-action-artwork swarmActionShield")} aria-hidden="true" />
        </article>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t.adminUi.nodeList}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.adminUi.nodeName}</th>
                <th>{t.adminStatus.status}</th>
                <th>URL</th>
                <th>{t.adminUi.latency}</th>
                <th>{t.adminStatus.version}</th>
                <th>{t.adminUi.cloudinaryAccount}</th>
                <th>{t.adminUi.cloudinaryCredits}</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const status = nodeStatuses[node.id];
                const usage = cloudinaryUsageByNode[node.id];
                const statusLabel =
                  status?.status === "online"
                    ? t.adminUi.online
                    : status?.status === "degraded"
                      ? t.adminUi.degraded
                      : status?.status === "offline"
                        ? t.adminUi.offline
                        : t.adminUi.unknown;
                const pillClass =
                  status?.status === "online"
                    ? styles.pillMint
                    : status?.status === "degraded"
                      ? styles.pillAmber
                      : status?.status === "offline"
                        ? styles.pillPink
                        : styles.pillLavender;

                let cloudinaryLabel = "—";
                if (usage?.status === "loading") {
                  cloudinaryLabel = t.common.loading;
                } else if (usage?.status === "error") {
                  cloudinaryLabel = t.adminUi.cloudinaryUsageFailed;
                } else if (usage?.status === "ready") {
                  if (!usage.enabled) {
                    cloudinaryLabel = t.adminUi.cloudinaryDisabled;
                  } else if (!usage.configured) {
                    cloudinaryLabel = t.adminUi.cloudinaryNotConfigured;
                  } else {
                    cloudinaryLabel = usage.cloudName || t.adminUi.cloudinaryNotConfigured;
                  }
                }

                const credits = usage?.credits;
                const usedPercent = credits ? Math.max(0, Math.min(100, credits.used_percent)) : 0;
                const usageBarClass =
                  usedPercent >= 95
                    ? styles.swarmUsageBarDanger
                    : usedPercent >= 80
                      ? styles.swarmUsageBarWarn
                      : undefined;

                return (
                  <tr key={node.id}>
                    <td className="font-bold">{getNodeDisplayName(node, t.adminUi.currentNode)}</td>
                    <td>
                      <span className={cn(styles.pill, pillClass)}>{statusLabel}</span>
                    </td>
                    <td className={styles.mono}>{node.baseUrl}</td>
                    <td>{status?.latencyMs !== undefined ? `${status.latencyMs}ms` : "—"}</td>
                    <td>{status?.version ? `v${status.version}` : "—"}</td>
                    <td>
                      <span className={usage?.cloudName && usage.enabled && usage.configured ? styles.swarmCloudName : styles.swarmUsageMuted}>
                        {cloudinaryLabel}
                      </span>
                    </td>
                    <td>
                      {usage?.status === "ready" && credits ? (
                        <div className={styles.swarmUsageCell}>
                          <div className={styles.swarmUsageMeta}>
                            <span>
                              {t.adminUi.cloudinaryCreditsFormat
                                .replace("{usage}", formatCreditsNumber(credits.usage))
                                .replace("{limit}", formatCreditsNumber(credits.limit))}
                            </span>
                            <span className={styles.swarmUsagePercent}>{Math.round(usedPercent)}%</span>
                          </div>
                          <span
                            className={cn(styles.swarmUsageBar, usageBarClass)}
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(usedPercent)}
                          >
                            <i style={{ width: `${usedPercent}%` }} />
                          </span>
                        </div>
                      ) : (
                        <span className={styles.swarmUsageMuted}>
                          {usage?.status === "loading"
                            ? t.common.loading
                            : usage?.error || (usage?.status === "error" ? t.adminUi.cloudinaryUsageFailed : "—")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.swarmFeatureGrid} aria-label={t.adminUi.swarmCapabilities}>
        <article>
          <span className="admin-swarm-action-artwork swarmActionDatabase" aria-hidden="true" />
          <div><h2>{t.adminUi.sharedStorage}</h2><p>{t.adminUi.sharedStorageDescription}</p></div>
        </article>
        <article>
          <span className="admin-swarm-action-artwork swarmActionNetwork" aria-hidden="true" />
          <div><h2>{t.adminUi.crossNodeScheduling}</h2><p>{t.adminUi.crossNodeSchedulingDescription}</p></div>
        </article>
        <article>
          <span className="admin-swarm-action-artwork swarmActionWarning" aria-hidden="true" />
          <div><h2>{t.adminUi.failover}</h2><p>{t.adminUi.failoverDescription}</p></div>
        </article>
      </section>

      <section className={cn(styles.panel, "admin-swarm-settings")}>
        <h2 className={styles.panelTitle}>{t.adminUi.sharedPolicy}</h2>
        <p className="admin-swarm-settings-desc">
          {t.adminUi.sharedPolicyDescription}
        </p>

        <div className="admin-swarm-settings-grid">
          <label className="admin-swarm-field">
            <span>{t.adminUi.uploadStrategy}</span>
            <select
              id="upload-strategy"
              value={swarmConfig.uploadStrategy}
              onChange={(event) =>
                setSwarmConfig({ ...swarmConfig, uploadStrategy: event.target.value as UploadStrategy })
              }
            >
              <option value="manual">{t.adminUi.manualTargetNode}</option>
              <option value="round-robin">{t.adminUi.roundRobinNodes}</option>
              <option value="random">{t.adminUi.randomAvailableNode}</option>
              <option value="available-first">{t.adminUi.firstAvailableNode}</option>
            </select>
          </label>

          <label className="admin-swarm-switch-row">
            <span>
              <strong>{t.adminUi.previewDelivery}</strong>
              <small>{t.adminUi.previewDeliveryDescription}</small>
            </span>
            <span className="admin-config-switch">
              <input
                type="checkbox"
                checked={swarmConfig.previewDeliveryEnabled}
                onChange={(event) =>
                  setSwarmConfig({ ...swarmConfig, previewDeliveryEnabled: event.target.checked })
                }
              />
              <i />
              <b>{swarmConfig.previewDeliveryEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
            </span>
          </label>
        </div>

        <div className="admin-swarm-provider-grid">
          {swarmProviders.map((provider) => (
            <label key={provider} className="admin-swarm-provider-card">
              <span>
                <strong>{provider === "custom" ? t.adminConfig.typeCustom : provider === "cloudinary" ? "Cloudinary" : provider === "tgstate" ? "tgState" : "Telegram"}</strong>
                <small>
                  {swarmConfig.providerDeliveryPolicy[provider]?.mode === "owner-node"
                    ? t.adminUi.ownerNodeDelivery
                    : t.adminUi.existingDeliveryChain}
                </small>
              </span>
              <select
                value={swarmConfig.providerDeliveryPolicy[provider]?.mode || "existing-chain"}
                onChange={(event) =>
                  updateProviderDeliveryMode(provider, event.target.value as ProviderDeliveryMode)
                }
              >
                <option value="owner-node">{t.adminUi.ownerNode}</option>
                <option value="existing-chain">{t.adminUi.existingChain}</option>
              </select>
            </label>
          ))}
        </div>

        {swarmConfig.providerDeliveryPolicy.cloudinary.mode !== "owner-node" && (
          <div className="admin-swarm-warning">
            <span className="admin-swarm-action-artwork swarmActionWarning" aria-hidden="true" />
            <p>{t.adminUi.cloudinaryDeliveryWarning}</p>
          </div>
        )}
      </section>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}
