import {
  createDefaultSelectionParamsConfig,
  normalizeSelectionParamsConfig,
  parseSelectionParams
} from '@/lib/selection-params';
import { AppError } from '@/types/errors';

describe('selection-params', () => {
  const enabledConfig = {
    selectionParams: {
      timeWeighting: {
        enabled: true
      }
    }
  } as any;

  it('应提供默认随机选择参数配置', () => {
    expect(createDefaultSelectionParamsConfig()).toEqual({
      timeWeighting: {
        enabled: false
      }
    });
  });

  it('应兼容缺失配置并默认关闭时间窗口加权', () => {
    expect(normalizeSelectionParamsConfig(undefined)).toEqual({
      timeWeighting: {
        enabled: false
      }
    });
  });

  it('未传时间加权参数时不返回选择参数', () => {
    expect(parseSelectionParams({}, enabledConfig)).toEqual({});
  });

  it('参数未启用时应拒绝 timeWindow/timeWeight', () => {
    expect(() => parseSelectionParams(
      { timeWindow: '7d', timeWeight: '3' },
      { selectionParams: { timeWeighting: { enabled: false } } } as any
    )).toThrow(AppError);
  });

  it('应解析滚动时间窗口', () => {
    const now = new Date('2026-06-02T12:00:00.000Z');
    const parsed = parseSelectionParams(
      { timeWindow: '7d', timeWeight: '3' },
      enabledConfig,
      now
    );

    expect(parsed.timeWeighting).toEqual({
      start: new Date('2026-05-26T12:00:00.000Z'),
      end: now,
      weight: 3,
      source: 'rolling',
      cacheKey: 'rolling:7d:weight:3'
    });
  });

  it('应解析固定时间窗口', () => {
    const parsed = parseSelectionParams(
      {
        timeStart: '2026-05-01T00:00:00.000Z',
        timeEnd: '2026-05-31T23:59:59.000Z',
        timeWeight: '5'
      },
      enabledConfig
    );

    expect(parsed.timeWeighting).toEqual({
      start: new Date('2026-05-01T00:00:00.000Z'),
      end: new Date('2026-05-31T23:59:59.000Z'),
      weight: 5,
      source: 'fixed',
      cacheKey: 'fixed:2026-05-01T00:00:00.000Z:2026-05-31T23:59:59.000Z:weight:5'
    });
  });

  it('应拒绝冲突、缺失和越界参数', () => {
    expect(() => parseSelectionParams(
      { timeWindow: '7d', timeStart: '2026-05-01T00:00:00Z', timeEnd: '2026-05-02T00:00:00Z', timeWeight: '3' },
      enabledConfig
    )).toThrow(AppError);
    expect(() => parseSelectionParams({ timeWindow: '7d' }, enabledConfig)).toThrow(AppError);
    expect(() => parseSelectionParams({ timeWeight: '3' }, enabledConfig)).toThrow(AppError);
    expect(() => parseSelectionParams({ timeWindow: '366d', timeWeight: '3' }, enabledConfig)).toThrow(AppError);
    expect(() => parseSelectionParams({ timeWindow: '7d', timeWeight: '101' }, enabledConfig)).toThrow(AppError);
    expect(() => parseSelectionParams(
      { timeStart: '2026-06-01T00:00:00Z', timeEnd: '2026-05-01T00:00:00Z', timeWeight: '3' },
      enabledConfig
    )).toThrow(AppError);
  });
});
