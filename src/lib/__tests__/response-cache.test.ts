import {
  FinalResponseCache,
  RandomPrefetchQueueCache,
  buildRandomPrefetchCacheKey,
  getRandomPrefetchTtlMs,
  getRollingTimeBucketMs
} from '@/lib/response-cache';
import type { TimeWeightingOptions } from '@/lib/selection-params';

function rollingWindow(durationMs: number, endMs: number): TimeWeightingOptions {
  return {
    start: new Date(endMs - durationMs),
    end: new Date(endMs),
    weight: 3,
    source: 'rolling',
    cacheKey: 'rolling:30m:weight:3'
  };
}

function cacheItem(id: string, size: number) {
  return {
    buffer: Buffer.alloc(size, id),
    mimeType: 'image/jpeg',
    size,
    imageId: id,
    publicId: id,
    createdAt: 1
  };
}

describe('response-cache', () => {
  it('滚动窗口预取 TTL 会按窗口长度动态收缩或使用默认值上限', () => {
    expect(getRandomPrefetchTtlMs(rollingWindow(30 * 60 * 1000, Date.UTC(2026, 0, 1)), 1_200_000))
      .toBe(180_000);
    expect(getRandomPrefetchTtlMs(rollingWindow(24 * 60 * 60 * 1000, Date.UTC(2026, 0, 1)), 1_200_000))
      .toBe(1_200_000);
    expect(getRandomPrefetchTtlMs(rollingWindow(7 * 24 * 60 * 60 * 1000, Date.UTC(2026, 0, 1)), 1_200_000))
      .toBe(1_200_000);
  });

  it('滚动窗口预取 key 使用时间桶而不是精确秒级窗口', () => {
    const durationMs = 30 * 60 * 1000;
    const base = Date.UTC(2026, 0, 1, 0, 0, 0);
    const first = rollingWindow(durationMs, base + 5_000);
    const sameBucket = rollingWindow(durationMs, base + 10_000);
    const nextBucket = rollingWindow(durationMs, base + 19_000);

    expect(getRollingTimeBucketMs(first)).toBe(18_000);

    const firstKey = buildRandomPrefetchCacheKey({
      groupIds: [],
      providers: [],
      timeWeighting: first,
      output: {}
    });
    const sameBucketKey = buildRandomPrefetchCacheKey({
      groupIds: [],
      providers: [],
      timeWeighting: sameBucket,
      output: {}
    });
    const nextBucketKey = buildRandomPrefetchCacheKey({
      groupIds: [],
      providers: [],
      timeWeighting: nextBucket,
      output: {}
    });

    expect(firstKey).toBe(sameBucketKey);
    expect(firstKey).not.toBe(nextBucketKey);
    expect(firstKey).toContain('bucket:18000');
  });

  it('随机预取 key 会区分最终输出处理参数', () => {
    const base = {
      groupIds: ['g1'],
      providers: ['cloudinary'],
      output: {}
    };

    const originKey = buildRandomPrefetchCacheKey(base);
    const webpKey = buildRandomPrefetchCacheKey({
      ...base,
      output: {
        format: 'webp'
      }
    });
    const resizedKey = buildRandomPrefetchCacheKey({
      ...base,
      output: {
        width: 800,
        height: 600,
        fit: 'cover'
      }
    });

    expect(originKey).not.toBe(webpKey);
    expect(originKey).not.toBe(resizedKey);
    expect(webpKey).toContain('format:webp');
    expect(resizedKey).toContain('width:800');
  });

  it('随机预取队列命中后会消费队列项', () => {
    const cache = new RandomPrefetchQueueCache({ perKey: 2, maxKeys: 8 });
    cache.enqueue('all', cacheItem('a', 4), 1_000, 100);
    cache.enqueue('all', cacheItem('b', 4), 1_000, 100);

    expect(cache.getState('all', 100).itemCount).toBe(2);
    expect(cache.take('all', 100)?.imageId).toBe('a');
    expect(cache.getState('all', 100).itemCount).toBe(1);
    expect(cache.take('all', 100)?.imageId).toBe('b');
    expect(cache.getState('all', 100).hasItem).toBe(false);
  });

  it('最终响应缓存命中可复用且按 TTL 过期', () => {
    const cache = new FinalResponseCache({
      ttlMs: 1_000,
      maxBytes: 100,
      maxKeys: 10,
      maxEntryBytes: 100
    });

    expect(cache.set('a', cacheItem('a', 4), 1_000, 100)).toBe(true);
    expect(cache.get('a', 500)?.imageId).toBe('a');
    expect(cache.get('a', 900)?.imageId).toBe('a');
    expect(cache.get('a', 1_101)).toBeUndefined();
  });

  it('最终响应缓存超过最大 key 数时按 LRU 淘汰', () => {
    const cache = new FinalResponseCache({
      ttlMs: 10_000,
      maxBytes: 100,
      maxKeys: 2,
      maxEntryBytes: 100
    });

    cache.set('a', cacheItem('a', 4), 10_000, 100);
    cache.set('b', cacheItem('b', 4), 10_000, 100);
    expect(cache.get('a', 101)).toBeTruthy();
    cache.set('c', cacheItem('c', 4), 10_000, 102);

    expect(cache.get('b', 103)).toBeUndefined();
    expect(cache.get('a', 103)).toBeTruthy();
    expect(cache.get('c', 103)).toBeTruthy();
  });

  it('最终响应缓存超过总内存预算或单项大小时会淘汰或拒绝缓存', () => {
    const cache = new FinalResponseCache({
      ttlMs: 10_000,
      maxBytes: 7,
      maxKeys: 10,
      maxEntryBytes: 5
    });

    expect(cache.set('oversize', cacheItem('oversize', 6), 10_000, 100)).toBe(false);
    expect(cache.stats(100).keys).toBe(0);

    cache.set('a', cacheItem('a', 4), 10_000, 100);
    cache.set('b', cacheItem('b', 4), 10_000, 101);

    expect(cache.get('a', 102)).toBeUndefined();
    expect(cache.get('b', 102)).toBeTruthy();
    expect(cache.stats(102).bytes).toBe(4);
  });
});
