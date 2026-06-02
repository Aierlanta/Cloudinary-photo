import * as ipaddr from 'ipaddr.js';
import { prisma } from './prisma';
import type { IPWhitelistEntry, SecurityConfig } from '@/types/models';

export const SECURITY_CONFIG_ID = 'default';
export const GUARD_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 1,
  message: '当前处于警戒状态，非白名单 IP 每分钟仅允许 1 次请求'
};

const CONFIG_CACHE_TTL_MS = 5000;
const AUTO_GUARD_CHECK_INTERVAL_MS = 10000;
const DEFAULT_GUARD_WINDOW_MINUTES = 5;
const DEFAULT_GUARD_UNIQUE_IP_THRESHOLD = 50;

interface RiskControlCache {
  value: RiskControlSnapshot;
  expiresAt: number;
}

export interface RiskControlSnapshot {
  config: SecurityConfig;
  whitelist: IPWhitelistEntry[];
}

export interface RiskControlDecision {
  isWhitelisted: boolean;
  whitelistOnlyBlocked: boolean;
  guardLimited: boolean;
  reason?: string;
}

let riskControlCache: RiskControlCache | null = null;
let lastAutoGuardCheckAt = 0;

export function clearRiskControlCache(): void {
  riskControlCache = null;
  lastAutoGuardCheckAt = 0;
}

export function createDefaultSecurityConfig(): SecurityConfig {
  const now = new Date();
  return {
    id: SECURITY_CONFIG_ID,
    guardEnabled: false,
    guardAutoEnabled: false,
    guardTriggerWindowMinutes: DEFAULT_GUARD_WINDOW_MINUTES,
    guardTriggerUniqueIpThreshold: DEFAULT_GUARD_UNIQUE_IP_THRESHOLD,
    whitelistOnlyEnabled: false,
    guardTriggeredAt: null,
    guardTriggeredReason: null,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeSecurityConfig(config: any): SecurityConfig {
  const defaults = createDefaultSecurityConfig();
  return {
    id: config?.id || defaults.id,
    guardEnabled: Boolean(config?.guardEnabled ?? defaults.guardEnabled),
    guardAutoEnabled: Boolean(config?.guardAutoEnabled ?? defaults.guardAutoEnabled),
    guardTriggerWindowMinutes: Number(config?.guardTriggerWindowMinutes ?? defaults.guardTriggerWindowMinutes),
    guardTriggerUniqueIpThreshold: Number(config?.guardTriggerUniqueIpThreshold ?? defaults.guardTriggerUniqueIpThreshold),
    whitelistOnlyEnabled: Boolean(config?.whitelistOnlyEnabled ?? defaults.whitelistOnlyEnabled),
    guardTriggeredAt: config?.guardTriggeredAt ?? null,
    guardTriggeredReason: config?.guardTriggeredReason ?? null,
    createdAt: config?.createdAt ?? defaults.createdAt,
    updatedAt: config?.updatedAt ?? defaults.updatedAt
  };
}

export function validateWhitelistCidr(raw: string): string {
  const cidr = raw.trim();
  if (!cidr) {
    throw new Error('白名单 IP/CIDR 不能为空');
  }

  try {
    if (cidr.includes('/')) {
      ipaddr.parseCIDR(cidr);
    } else {
      ipaddr.parse(cidr);
    }
    return cidr;
  } catch {
    throw new Error('白名单条目必须是有效的 IP 或 CIDR');
  }
}

export function isIPInCidr(ip: string, cidr: string): boolean {
  try {
    const parsedIp = ipaddr.parse(ip);
    if (cidr.includes('/')) {
      const [range, prefixLength] = ipaddr.parseCIDR(cidr);
      return parsedIp.kind() === range.kind() && parsedIp.match(range, prefixLength);
    }
    const parsedCidrIp = ipaddr.parse(cidr);
    return parsedIp.kind() === parsedCidrIp.kind() && parsedIp.toNormalizedString() === parsedCidrIp.toNormalizedString();
  } catch {
    return false;
  }
}

export function isIPWhitelisted(ip: string, whitelist: Pick<IPWhitelistEntry, 'cidr' | 'isEnabled'>[]): boolean {
  return whitelist.some((entry) => entry.isEnabled && isIPInCidr(ip, entry.cidr));
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002';
}

export async function getOrCreateSecurityConfig(): Promise<SecurityConfig> {
  try {
    const config = await prisma.securityConfig.upsert({
      where: { id: SECURITY_CONFIG_ID },
      update: {},
      create: {
        id: SECURITY_CONFIG_ID,
        guardEnabled: false,
        guardAutoEnabled: false,
        guardTriggerWindowMinutes: DEFAULT_GUARD_WINDOW_MINUTES,
        guardTriggerUniqueIpThreshold: DEFAULT_GUARD_UNIQUE_IP_THRESHOLD,
        whitelistOnlyEnabled: false
      }
    });
    return normalizeSecurityConfig(config);
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.securityConfig.findUnique({
      where: { id: SECURITY_CONFIG_ID }
    });
    if (!existing) {
      throw error;
    }
    return normalizeSecurityConfig(existing);
  }
}

export async function updateSecurityConfig(input: Partial<Pick<
  SecurityConfig,
  'guardEnabled' | 'guardAutoEnabled' | 'guardTriggerWindowMinutes' | 'guardTriggerUniqueIpThreshold' | 'whitelistOnlyEnabled'
>>): Promise<SecurityConfig> {
  const current = await getOrCreateSecurityConfig();
  const nextGuardEnabled = input.guardEnabled ?? current.guardEnabled;
  const guardDisabled = current.guardEnabled && nextGuardEnabled === false;
  const updated = await prisma.securityConfig.update({
    where: { id: SECURITY_CONFIG_ID },
    data: {
      guardEnabled: nextGuardEnabled,
      guardAutoEnabled: input.guardAutoEnabled ?? current.guardAutoEnabled,
      guardTriggerWindowMinutes: input.guardTriggerWindowMinutes ?? current.guardTriggerWindowMinutes,
      guardTriggerUniqueIpThreshold: input.guardTriggerUniqueIpThreshold ?? current.guardTriggerUniqueIpThreshold,
      whitelistOnlyEnabled: input.whitelistOnlyEnabled ?? current.whitelistOnlyEnabled,
      guardTriggeredAt: guardDisabled ? null : current.guardTriggeredAt,
      guardTriggeredReason: guardDisabled ? null : current.guardTriggeredReason
    }
  });
  clearRiskControlCache();
  return normalizeSecurityConfig(updated);
}

export async function getIPWhitelistEntries(): Promise<IPWhitelistEntry[]> {
  return prisma.iPWhitelistEntry.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function createIPWhitelistEntry(input: {
  cidr: string;
  note?: string | null;
  isEnabled?: boolean;
}): Promise<IPWhitelistEntry> {
  const cidr = validateWhitelistCidr(input.cidr);
  const entry = await prisma.iPWhitelistEntry.create({
    data: {
      cidr,
      note: input.note?.trim() || null,
      isEnabled: input.isEnabled ?? true
    }
  });
  clearRiskControlCache();
  return entry;
}

export async function updateIPWhitelistEntry(input: {
  id: string;
  cidr?: string;
  note?: string | null;
  isEnabled?: boolean;
}): Promise<IPWhitelistEntry> {
  const data: {
    cidr?: string;
    note?: string | null;
    isEnabled?: boolean;
  } = {};
  if (typeof input.cidr !== 'undefined') {
    data.cidr = validateWhitelistCidr(input.cidr);
  }
  if (typeof input.note !== 'undefined') {
    data.note = input.note?.trim() || null;
  }
  if (typeof input.isEnabled !== 'undefined') {
    data.isEnabled = input.isEnabled;
  }

  const entry = await prisma.iPWhitelistEntry.update({
    where: { id: input.id },
    data
  });
  clearRiskControlCache();
  return entry;
}

export async function deleteIPWhitelistEntry(id: string): Promise<void> {
  await prisma.iPWhitelistEntry.delete({
    where: { id }
  });
  clearRiskControlCache();
}

export async function getRiskControlSnapshot(forceRefresh = false): Promise<RiskControlSnapshot> {
  const now = Date.now();
  if (!forceRefresh && riskControlCache && now <= riskControlCache.expiresAt) {
    return riskControlCache.value;
  }

  const [config, whitelist] = await Promise.all([
    getOrCreateSecurityConfig(),
    getIPWhitelistEntries()
  ]);
  const snapshot = { config, whitelist };
  riskControlCache = {
    value: snapshot,
    expiresAt: now + CONFIG_CACHE_TTL_MS
  };
  return snapshot;
}

async function maybeTriggerAutomaticGuard(snapshot: RiskControlSnapshot): Promise<SecurityConfig> {
  const { config, whitelist } = snapshot;
  if (!config.guardAutoEnabled || config.guardEnabled) {
    return config;
  }

  const now = Date.now();
  if (now - lastAutoGuardCheckAt < AUTO_GUARD_CHECK_INTERVAL_MS) {
    return config;
  }
  lastAutoGuardCheckAt = now;

  const start = new Date(now - config.guardTriggerWindowMinutes * 60 * 1000);
  const uniqueIpRows = await prisma.accessLog.groupBy({
    by: ['ip'],
    where: {
      timestamp: { gte: start },
      path: { startsWith: '/api/' },
      NOT: [
        { path: { startsWith: '/api/admin' } },
        { path: { startsWith: '/api/internal' } }
      ]
    }
  });
  const nonWhitelistIpCount = uniqueIpRows
    .map((row) => row.ip)
    .filter((ip) => !isIPWhitelisted(ip, whitelist)).length;

  if (nonWhitelistIpCount < config.guardTriggerUniqueIpThreshold) {
    return config;
  }

  const reason = `${config.guardTriggerWindowMinutes} 分钟内检测到 ${nonWhitelistIpCount} 个非白名单 IP 请求`;
  const updated = await prisma.securityConfig.update({
    where: { id: SECURITY_CONFIG_ID },
    data: {
      guardEnabled: true,
      guardTriggeredAt: new Date(),
      guardTriggeredReason: reason
    }
  });
  clearRiskControlCache();
  return normalizeSecurityConfig(updated);
}

export async function evaluatePublicRiskControl(ip: string): Promise<RiskControlDecision> {
  const initialSnapshot = await getRiskControlSnapshot();
  const activeConfig = await maybeTriggerAutomaticGuard(initialSnapshot);
  const snapshot = activeConfig === initialSnapshot.config
    ? initialSnapshot
    : { ...initialSnapshot, config: activeConfig };

  const isWhitelisted = isIPWhitelisted(ip, snapshot.whitelist);
  if (isWhitelisted) {
    return {
      isWhitelisted: true,
      whitelistOnlyBlocked: false,
      guardLimited: false
    };
  }

  if (snapshot.config.whitelistOnlyEnabled) {
    return {
      isWhitelisted: false,
      whitelistOnlyBlocked: true,
      guardLimited: false,
      reason: '当前处于白名单模式，仅白名单 IP 可以访问公开 API'
    };
  }

  if (snapshot.config.guardEnabled) {
    return {
      isWhitelisted: false,
      whitelistOnlyBlocked: false,
      guardLimited: true,
      reason: GUARD_RATE_LIMIT.message
    };
  }

  return {
    isWhitelisted: false,
    whitelistOnlyBlocked: false,
    guardLimited: false
  };
}
