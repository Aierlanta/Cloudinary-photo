import { databaseService } from '@/lib/database';
import {
  buildSignedResolveUrl,
  getImageOwner,
  normalizeBaseUrl
} from '@/lib/swarm-node';
import type { NextRequest } from 'next/server';
import type { Image, ProviderDeliveryPolicy, SwarmConfig, SwarmProvider } from '@/types/models';

export const SWARM_PROVIDERS: SwarmProvider[] = ['cloudinary', 'tgstate', 'telegram', 'custom'];

export function normalizeSwarmProvider(provider?: string | null): SwarmProvider {
  if (provider === 'cloudinary' || provider === 'tgstate' || provider === 'telegram' || provider === 'custom') {
    return provider;
  }
  return 'custom';
}

export function resolveImageProvider(image: Pick<Image, 'primaryProvider' | 'url'>): SwarmProvider {
  return normalizeSwarmProvider(image.primaryProvider || inferProviderFromUrl(image.url));
}

export function inferProviderFromUrl(url?: string | null): SwarmProvider {
  if (!url) return 'custom';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('res.cloudinary.com')) return 'cloudinary';
    if (parsed.hostname === 'api.telegram.org' || parsed.pathname.includes('/api/telegram/image')) return 'telegram';
  } catch {
    // 非 URL 字符串按自定义外链处理
  }
  return 'custom';
}

export function shouldUseOwnerNodeDelivery(provider: string | null | undefined, config: SwarmConfig): boolean {
  if (!config.previewDeliveryEnabled) return false;
  const normalizedProvider = normalizeSwarmProvider(provider);
  return config.providerDeliveryPolicy[normalizedProvider]?.mode === 'owner-node';
}

export function shouldImageUseOwnerNodeDelivery(
  image: Pick<Image, 'primaryProvider' | 'url'>,
  config: SwarmConfig
): boolean {
  return shouldUseOwnerNodeDelivery(resolveImageProvider(image), config);
}

export async function getEffectiveSwarmConfig(): Promise<SwarmConfig> {
  return databaseService.getOrCreateSwarmConfig();
}

export async function getProviderDeliveryPolicy(): Promise<ProviderDeliveryPolicy> {
  const config = await getEffectiveSwarmConfig();
  return config.providerDeliveryPolicy;
}

export function buildSwarmConfigWarnings(config: SwarmConfig): string[] {
  const warnings: string[] = [];
  if (config.providerDeliveryPolicy.cloudinary.mode !== 'owner-node') {
    warnings.push('Cloudinary 未走 owner 节点交付，可能暴露管理端来源和访问模式，增加 provider 风控风险。');
  }
  return warnings;
}

export async function buildAdminPreviewUrl(
  request: NextRequest,
  image: Pick<Image, 'id' | 'url' | 'primaryProvider' | 'ownerNodeId'>,
  config?: SwarmConfig
): Promise<string | undefined> {
  const effectiveConfig = config || await getEffectiveSwarmConfig();
  if (!shouldImageUseOwnerNodeDelivery(image, effectiveConfig)) {
    return undefined;
  }

  const owner = getImageOwner(image, request);
  const ownerBaseUrl = normalizeBaseUrl(owner.baseUrl);
  if (!ownerBaseUrl) return undefined;

  return buildSignedResolveUrl(ownerBaseUrl, request, image, 'admin-preview', 300).toString();
}
