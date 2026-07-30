"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, Flower2, Network, RefreshCw, Save } from "lucide-react";
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

export default function SwarmPage() {
  const { t } = useLocale();
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
            <Flower2 className={styles.heroIcon} aria-hidden />
          </h1>
          <p className={styles.heroSubtitle}>
            {t.adminUi.swarmSubtitle}
          </p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={() => refreshNodeStatuses().catch(() => {})}
            className={cn(styles.btn, styles.btnLavender)}
          >
            <RefreshCw className="w-4 h-4" />
            {t.common.refresh}
          </button>
          <button
            type="button"
            onClick={saveSwarmConfig}
            disabled={saving}
            className={cn(styles.btn, styles.btnPink)}
          >
            <Save className="w-4 h-4" />
            {saving ? t.adminConfig.saving : t.adminUi.saveSwarmConfig}
          </button>
        </div>
      </header>

      <section className={styles.statGrid} aria-label={t.adminUi.nodeStatusSummary}>
        <article className={cn(styles.statCard, styles.toneMint)}>
          <p className={styles.statLabel}>{t.adminUi.totalNodes}</p>
          <p className={styles.statValue}>{nodes.length}</p>
          <Network className={styles.statIcon} aria-hidden />
        </article>
        <article className={cn(styles.statCard, styles.toneLavender)}>
          <p className={styles.statLabel}>{t.adminUi.online}</p>
          <p className={styles.statValue}>{statusCounts.online}</p>
          <Database className={styles.statIcon} aria-hidden />
        </article>
        <article className={cn(styles.statCard, styles.toneAmber)}>
          <p className={styles.statLabel}>{t.adminUi.degraded}</p>
          <p className={styles.statValue}>{statusCounts.degraded}</p>
          <AlertTriangle className={styles.statIcon} aria-hidden />
        </article>
        <article className={cn(styles.statCard, styles.tonePink)}>
          <p className={styles.statLabel}>{t.adminUi.offline}</p>
          <p className={styles.statValue}>{statusCounts.offline}</p>
          <Network className={styles.statIcon} aria-hidden />
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
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const status = nodeStatuses[node.id];
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

                return (
                  <tr key={node.id}>
                    <td className="font-bold">{getNodeDisplayName(node, t.adminUi.currentNode)}</td>
                    <td>
                      <span className={cn(styles.pill, pillClass)}>{statusLabel}</span>
                    </td>
                    <td className={styles.mono}>{node.baseUrl}</td>
                    <td>{status?.latencyMs !== undefined ? `${status.latencyMs}ms` : "—"}</td>
                    <td>{status?.version ? `v${status.version}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.swarmFeatureGrid} aria-label={t.adminUi.swarmCapabilities}>
        <article>
          <Database aria-hidden />
          <div><h2>{t.adminUi.sharedStorage}</h2><p>{t.adminUi.sharedStorageDescription}</p></div>
        </article>
        <article>
          <Network aria-hidden />
          <div><h2>{t.adminUi.crossNodeScheduling}</h2><p>{t.adminUi.crossNodeSchedulingDescription}</p></div>
        </article>
        <article>
          <AlertTriangle aria-hidden />
          <div><h2>{t.adminUi.failover}</h2><p>{t.adminUi.failoverDescription}</p></div>
        </article>
      </section>

      <section className={cn(styles.panel, "admin-swarm-settings")}>
        <h2 className={styles.panelTitle}>{t.adminUi.sharedPolicy}</h2>
        <p className="relative z-[1] text-sm text-muted-foreground mb-4">
          {t.adminUi.sharedPolicyDescription}
        </p>

        <div className="relative z-[1] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={styles.field}>
            <label htmlFor="upload-strategy">{t.adminUi.uploadStrategy}</label>
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
          </div>

          <label className={cn(styles.groupCard, "min-h-0 !flex-row items-center justify-between")}>
            <span className="relative z-[1]">
              <strong className="block text-sm">{t.adminUi.previewDelivery}</strong>
              <small className="text-muted-foreground">{t.adminUi.previewDeliveryDescription}</small>
            </span>
            <input
              type="checkbox"
              className="relative z-[1]"
              checked={swarmConfig.previewDeliveryEnabled}
              onChange={(event) =>
                setSwarmConfig({ ...swarmConfig, previewDeliveryEnabled: event.target.checked })
              }
            />
          </label>
        </div>

        <div className="relative z-[1] grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {swarmProviders.map((provider) => (
            <div key={provider} className={cn(styles.miniCard, "flex items-center justify-between gap-3")}>
              <div>
                <p className="font-bold text-sm">{provider === "custom" ? t.adminConfig.typeCustom : provider === "cloudinary" ? "Cloudinary" : provider === "tgstate" ? "tgState" : "Telegram"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {swarmConfig.providerDeliveryPolicy[provider]?.mode === "owner-node"
                    ? t.adminUi.ownerNodeDelivery
                    : t.adminUi.existingDeliveryChain}
                </p>
              </div>
              <select
                value={swarmConfig.providerDeliveryPolicy[provider]?.mode || "existing-chain"}
                onChange={(event) =>
                  updateProviderDeliveryMode(provider, event.target.value as ProviderDeliveryMode)
                }
                className="px-2 py-1 border-2 border-border rounded-full text-xs bg-card outline-none"
              >
                <option value="owner-node">{t.adminUi.ownerNode}</option>
                <option value="existing-chain">{t.adminUi.existingChain}</option>
              </select>
            </div>
          ))}
        </div>

        {swarmConfig.providerDeliveryPolicy.cloudinary.mode !== "owner-node" && (
          <div className="relative z-[1] flex items-start gap-3 p-3 mt-4 rounded-2xl border-2 border-amber-400/50 bg-amber-400/10">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <p className="text-sm">
              {t.adminUi.cloudinaryDeliveryWarning}
            </p>
          </div>
        )}
      </section>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}
