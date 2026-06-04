import { createHash } from 'crypto';
import type { ResizeFit, TransparencyOptions } from '@/lib/image-processor';
import type { TimeWeightingOptions } from '@/lib/selection-params';
import type { Image, ManagedResponseFormat } from '@/types/models';

export interface ResponseOutputVariant {
  format?: ManagedResponseFormat;
  quality?: number;
  transparency?: TransparencyOptions | null;
  width?: number;
  height?: number;
  fit?: ResizeFit;
}

export interface CachedImageResponse {
  buffer: Buffer;
  mimeType: string;
  size: number;
  imageId: string;
  publicId: string;
  ownerNodeId?: string;
  createdAt: number;
}

interface ExpiringCachedImageResponse extends CachedImageResponse {
  expiresAt: number;
}

interface RandomPrefetchSlot {
  items: ExpiringCachedImageResponse[];
  inflight?: Promise<void>;
  expiresAt: number;
  lastAccessedAt: number;
}

export interface FinalResponseCacheEntry extends CachedImageResponse {
  expiresAt: number;
  lastAccessedAt: number;
}

export function parsePositiveIntegerEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value !== 'undefined' && value !== '');
}

export const RESPONSE_RANDOM_PREFETCH_TTL_MS = parsePositiveIntegerEnv(
  firstDefined(process.env.RESPONSE_RANDOM_PREFETCH_TTL_MS, process.env.RESPONSE_PREFETCH_TTL_MS),
  1_200_000
);
export const RESPONSE_RANDOM_PREFETCH_MAX_KEYS = parsePositiveIntegerEnv(
  firstDefined(process.env.RESPONSE_RANDOM_PREFETCH_MAX_KEYS, process.env.RESPONSE_PREFETCH_MAX_SLOTS),
  128
);
export const RESPONSE_RANDOM_PREFETCH_PER_KEY = parsePositiveIntegerEnv(
  process.env.RESPONSE_RANDOM_PREFETCH_PER_KEY,
  2
);

export const RESPONSE_FINAL_CACHE_TTL_MS = parsePositiveIntegerEnv(
  process.env.RESPONSE_FINAL_CACHE_TTL_MS,
  1_200_000
);
export const RESPONSE_FINAL_CACHE_MAX_BYTES = parsePositiveIntegerEnv(
  process.env.RESPONSE_FINAL_CACHE_MAX_BYTES,
  134_217_728
);
export const RESPONSE_FINAL_CACHE_MAX_KEYS = parsePositiveIntegerEnv(
  process.env.RESPONSE_FINAL_CACHE_MAX_KEYS,
  128
);
export const RESPONSE_FINAL_CACHE_MAX_ENTRY_BYTES = parsePositiveIntegerEnv(
  process.env.RESPONSE_FINAL_CACHE_MAX_ENTRY_BYTES,
  16_777_216
);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDateValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function normalizeBgColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return `#${normalized}`;
  }
  return normalized;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashStableValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 32);
}

export function buildResponseOutputVariantKey(variant: ResponseOutputVariant): string {
  const opacity = variant.transparency?.opacity;
  return [
    `format:${variant.format ?? 'origin'}`,
    `quality:${typeof variant.quality === 'number' ? variant.quality : 'origin'}`,
    `opacity:${typeof opacity === 'number' ? opacity : 'origin'}`,
    `bgColor:${normalizeBgColor(variant.transparency?.bgColor) ?? 'origin'}`,
    `width:${typeof variant.width === 'number' ? variant.width : 'origin'}`,
    `height:${typeof variant.height === 'number' ? variant.height : 'origin'}`,
    `fit:${variant.fit ?? 'origin'}`
  ].join(',');
}

export function getTimeWeightingDurationMs(timeWeighting?: TimeWeightingOptions): number | undefined {
  if (!timeWeighting) return undefined;
  const durationMs = timeWeighting.end.getTime() - timeWeighting.start.getTime();
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined;
}

export function getRandomPrefetchTtlMs(
  timeWeighting?: TimeWeightingOptions,
  defaultTtlMs: number = RESPONSE_RANDOM_PREFETCH_TTL_MS
): number {
  if (timeWeighting?.source !== 'rolling') {
    return defaultTtlMs;
  }

  const durationMs = getTimeWeightingDurationMs(timeWeighting);
  if (!durationMs) {
    return Math.min(defaultTtlMs, 60_000);
  }

  return Math.min(defaultTtlMs, Math.max(60_000, Math.floor(durationMs / 10)));
}

export function getRollingTimeBucketMs(timeWeighting?: TimeWeightingOptions): number | undefined {
  if (timeWeighting?.source !== 'rolling') return undefined;
  const durationMs = getTimeWeightingDurationMs(timeWeighting);
  if (!durationMs) return 1_000;
  return Math.floor(clamp(durationMs / 100, 1_000, 60_000));
}

export function buildTimeWeightingPrefetchKey(timeWeighting?: TimeWeightingOptions): string | undefined {
  if (!timeWeighting) return undefined;
  if (timeWeighting.source !== 'rolling') {
    return timeWeighting.cacheKey;
  }

  const bucketMs = getRollingTimeBucketMs(timeWeighting) ?? 1_000;
  const bucketStartMs = Math.floor(timeWeighting.end.getTime() / bucketMs) * bucketMs;
  return `${timeWeighting.cacheKey}:bucket:${bucketMs}:${new Date(bucketStartMs).toISOString()}`;
}

export function buildRandomPrefetchCacheKey(options: {
  groupIds: string[];
  providers: string[];
  timeWeighting?: TimeWeightingOptions;
  output: ResponseOutputVariant;
}): string {
  const parts: string[] = [];
  const uniqueProviders = Array.from(new Set((options.providers || []).filter(Boolean))).sort();
  const uniqueGroups = Array.from(new Set((options.groupIds || []).filter(Boolean))).sort();
  const timeWeightingKey = buildTimeWeightingPrefetchKey(options.timeWeighting);

  if (uniqueProviders.length > 0) {
    parts.push(`providers:${uniqueProviders.join(',')}`);
  }
  if (uniqueGroups.length > 0) {
    parts.push(`groups:${uniqueGroups.join(',')}`);
  }
  if (timeWeightingKey) {
    parts.push(`timeWeighting:${timeWeightingKey}`);
  }

  const filterKey = parts.length === 0 ? 'all' : parts.join('|');
  return `${filterKey}|output:${buildResponseOutputVariantKey(options.output)}`;
}

export function buildFinalResponseCacheKey(image: Pick<Image, 'id' | 'publicId' | 'url' | 'uploadedAt' | 'primaryProvider' | 'telegramFileId' | 'telegramFilePath' | 'ownerNodeId' | 'storageMetadata'>, output: ResponseOutputVariant): string {
  const sourceVersion = {
    id: image.id,
    publicId: image.publicId,
    url: image.url,
    uploadedAt: normalizeDateValue(image.uploadedAt),
    primaryProvider: image.primaryProvider ?? null,
    telegramFileId: image.telegramFileId ?? null,
    telegramFilePath: image.telegramFilePath ?? null,
    ownerNodeId: image.ownerNodeId ?? null,
    storageMetadata: image.storageMetadata ?? null
  };

  return `final:${image.id}:${hashStableValue({
    sourceVersion,
    output: buildResponseOutputVariantKey(output)
  })}`;
}

export class RandomPrefetchQueueCache {
  private slots = new Map<string, RandomPrefetchSlot>();

  constructor(
    private options: {
      perKey: number;
      maxKeys: number;
    }
  ) {}

  configure(options: Partial<{ perKey: number; maxKeys: number }>): void {
    this.options = {
      perKey: options.perKey && options.perKey > 0 ? Math.floor(options.perKey) : this.options.perKey,
      maxKeys: options.maxKeys && options.maxKeys > 0 ? Math.floor(options.maxKeys) : this.options.maxKeys
    };
    this.enforceLimit();
  }

  reset(): void {
    this.slots.clear();
  }

  getPerKey(): number {
    return this.options.perKey;
  }

  keys(now: number = Date.now()): string[] {
    this.pruneExpired(now);
    return Array.from(this.slots.keys());
  }

  getState(key: string, now: number = Date.now()): {
    hasSlot: boolean;
    itemCount: number;
    hasItem: boolean;
    hasInflight: boolean;
    expiresAt?: number;
  } {
    this.pruneExpired(now);
    const slot = this.slots.get(key);
    return {
      hasSlot: Boolean(slot),
      itemCount: slot?.items.length ?? 0,
      hasItem: Boolean(slot?.items.length),
      hasInflight: Boolean(slot?.inflight),
      expiresAt: slot?.expiresAt
    };
  }

  getItemCount(key: string, now: number = Date.now()): number {
    this.pruneExpired(now);
    return this.slots.get(key)?.items.length ?? 0;
  }

  take(key: string, now: number = Date.now()): CachedImageResponse | undefined {
    this.pruneExpired(now);
    const slot = this.slots.get(key);
    if (!slot) return undefined;

    while (slot.items.length > 0) {
      const item = slot.items.shift();
      if (item && item.expiresAt > now) {
        slot.lastAccessedAt = now;
        this.touch(key, slot);
        if (slot.items.length === 0 && !slot.inflight) {
          slot.expiresAt = now;
        }
        return item;
      }
    }

    if (!slot.inflight) {
      this.slots.delete(key);
    }
    return undefined;
  }

  enqueue(key: string, item: CachedImageResponse, ttlMs: number, now: number = Date.now()): boolean {
    const expiresAt = now + ttlMs;
    const slot = this.slots.get(key) ?? {
      items: [],
      expiresAt,
      lastAccessedAt: now
    };

    slot.items.push({ ...item, expiresAt });
    while (slot.items.length > this.options.perKey) {
      slot.items.shift();
    }
    slot.expiresAt = Math.max(expiresAt, ...slot.items.map((entry) => entry.expiresAt));
    slot.lastAccessedAt = now;
    this.touch(key, slot);
    this.enforceLimit(now);
    return true;
  }

  setInflight(key: string, inflight: Promise<void>, ttlMs: number, now: number = Date.now()): void {
    const existing = this.slots.get(key);
    const slot: RandomPrefetchSlot = existing ?? {
      items: [],
      expiresAt: now + ttlMs,
      lastAccessedAt: now
    };
    slot.inflight = inflight;
    slot.expiresAt = Math.max(slot.expiresAt, now + ttlMs);
    slot.lastAccessedAt = now;
    this.touch(key, slot);
    this.enforceLimit(now);
  }

  getInflight(key: string, now: number = Date.now()): Promise<void> | undefined {
    this.pruneExpired(now);
    return this.slots.get(key)?.inflight;
  }

  clearInflight(key: string, now: number = Date.now()): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    slot.inflight = undefined;
    slot.lastAccessedAt = now;
    if (slot.items.length === 0 && slot.expiresAt <= now) {
      this.slots.delete(key);
      return;
    }
    this.touch(key, slot);
  }

  setSlotForTests(key: string, expiresAt: number, item?: CachedImageResponse): void {
    this.slots.set(key, {
      items: item ? [{ ...item, expiresAt }] : [],
      expiresAt,
      lastAccessedAt: Date.now()
    });
    this.enforceLimit();
  }

  private touch(key: string, slot: RandomPrefetchSlot): void {
    this.slots.delete(key);
    this.slots.set(key, slot);
  }

  private pruneExpired(now: number = Date.now()): void {
    for (const [key, slot] of this.slots.entries()) {
      slot.items = slot.items.filter((item) => item.expiresAt > now);
      if (slot.items.length > 0) {
        slot.expiresAt = Math.max(...slot.items.map((item) => item.expiresAt));
      }
      if (!slot.inflight && (slot.items.length === 0 || slot.expiresAt <= now)) {
        this.slots.delete(key);
      }
    }
  }

  private enforceLimit(now: number = Date.now()): void {
    this.pruneExpired(now);
    while (this.slots.size > this.options.maxKeys) {
      const removableKey = Array.from(this.slots.entries()).find(([, slot]) => !slot.inflight)?.[0];
      if (!removableKey) break;
      this.slots.delete(removableKey);
    }
  }
}

export class FinalResponseCache {
  private entries = new Map<string, FinalResponseCacheEntry>();
  private totalBytes = 0;

  constructor(
    private options: {
      ttlMs: number;
      maxBytes: number;
      maxKeys: number;
      maxEntryBytes: number;
    }
  ) {}

  configure(options: Partial<{ ttlMs: number; maxBytes: number; maxKeys: number; maxEntryBytes: number }>): void {
    this.options = {
      ttlMs: options.ttlMs && options.ttlMs > 0 ? Math.floor(options.ttlMs) : this.options.ttlMs,
      maxBytes: options.maxBytes && options.maxBytes > 0 ? Math.floor(options.maxBytes) : this.options.maxBytes,
      maxKeys: options.maxKeys && options.maxKeys > 0 ? Math.floor(options.maxKeys) : this.options.maxKeys,
      maxEntryBytes: options.maxEntryBytes && options.maxEntryBytes > 0 ? Math.floor(options.maxEntryBytes) : this.options.maxEntryBytes
    };
    this.enforceLimit();
  }

  reset(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  get(key: string, now: number = Date.now()): FinalResponseCacheEntry | undefined {
    this.pruneExpired(now);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.delete(key);
      return undefined;
    }

    entry.lastAccessedAt = now;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, item: CachedImageResponse, ttlMs: number = this.options.ttlMs, now: number = Date.now()): boolean {
    const size = item.size || item.buffer.length;
    if (size > this.options.maxEntryBytes) {
      return false;
    }

    this.delete(key);
    this.entries.set(key, {
      ...item,
      size,
      expiresAt: now + ttlMs,
      lastAccessedAt: now
    });
    this.totalBytes += size;
    this.enforceLimit(now);
    return this.entries.has(key);
  }

  stats(now: number = Date.now()): { keys: number; bytes: number; maxBytes: number; maxKeys: number; maxEntryBytes: number } {
    this.pruneExpired(now);
    return {
      keys: this.entries.size,
      bytes: this.totalBytes,
      maxBytes: this.options.maxBytes,
      maxKeys: this.options.maxKeys,
      maxEntryBytes: this.options.maxEntryBytes
    };
  }

  private delete(key: string): void {
    const existing = this.entries.get(key);
    if (!existing) return;
    this.totalBytes -= existing.size;
    this.entries.delete(key);
  }

  private pruneExpired(now: number = Date.now()): void {
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.delete(key);
      }
    }
  }

  private enforceLimit(now: number = Date.now()): void {
    this.pruneExpired(now);
    while (this.entries.size > this.options.maxKeys || this.totalBytes > this.options.maxBytes) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      this.delete(oldestKey);
    }
  }
}

export const randomPrefetchCache = new RandomPrefetchQueueCache({
  perKey: RESPONSE_RANDOM_PREFETCH_PER_KEY,
  maxKeys: RESPONSE_RANDOM_PREFETCH_MAX_KEYS
});

export const finalResponseCache = new FinalResponseCache({
  ttlMs: RESPONSE_FINAL_CACHE_TTL_MS,
  maxBytes: RESPONSE_FINAL_CACHE_MAX_BYTES,
  maxKeys: RESPONSE_FINAL_CACHE_MAX_KEYS,
  maxEntryBytes: RESPONSE_FINAL_CACHE_MAX_ENTRY_BYTES
});
