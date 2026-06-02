import { AppError, ErrorType } from '@/types/errors';
import type { APIConfig, SelectionParamsConfig } from '@/types/models';

const MAX_TIME_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const TIME_WEIGHT_MIN = 1;
const TIME_WEIGHT_MAX = 100;

export interface TimeWeightingOptions {
  start: Date;
  end: Date;
  weight: number;
  source: 'rolling' | 'fixed';
  cacheKey: string;
}

export interface ParsedSelectionParams {
  timeWeighting?: TimeWeightingOptions;
}

export function createDefaultSelectionParamsConfig(): SelectionParamsConfig {
  return {
    timeWeighting: {
      enabled: false
    }
  };
}

export function normalizeSelectionParamsConfig(
  value?: Partial<SelectionParamsConfig> | null
): SelectionParamsConfig {
  const defaults = createDefaultSelectionParamsConfig();
  return {
    timeWeighting: {
      enabled: value?.timeWeighting?.enabled ?? defaults.timeWeighting.enabled
    }
  };
}

function parseTimeWeight(raw: string | undefined): number {
  if (typeof raw === 'undefined' || raw.trim() === '') {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '使用时间窗口加权时必须提供 timeWeight 参数',
      400
    );
  }

  if (!/^\d+$/.test(raw.trim())) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeWeight 仅支持 1-100 的整数',
      400
    );
  }

  const weight = Number(raw);
  if (!Number.isSafeInteger(weight) || weight < TIME_WEIGHT_MIN || weight > TIME_WEIGHT_MAX) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeWeight 仅支持 1-100 的整数',
      400
    );
  }

  return weight;
}

function parseRollingWindow(raw: string, now: Date): { start: Date; end: Date; cacheKey: string } {
  const match = raw.trim().toLowerCase().match(/^(\d+)(m|h|d|w)$/);
  if (!match) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeWindow 仅支持 m/h/d/w 单位，例如 30m、24h、7d、4w',
      400
    );
  }

  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeWindow 必须是正整数时间窗口',
      400
    );
  }

  const unit = match[2];
  const unitMs = unit === 'm'
    ? 60 * 1000
    : unit === 'h'
    ? 60 * 60 * 1000
    : unit === 'd'
    ? 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;
  const durationMs = amount * unitMs;

  if (!Number.isSafeInteger(durationMs) || durationMs > MAX_TIME_WINDOW_MS) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeWindow 最大支持 365d',
      400
    );
  }

  return {
    start: new Date(now.getTime() - durationMs),
    end: now,
    cacheKey: `rolling:${amount}${unit}`
  };
}

function parseFixedDate(raw: string | undefined, name: string): Date {
  if (typeof raw === 'undefined' || raw.trim() === '') {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `固定时间窗口必须同时提供 ${name}`,
      400
    );
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${name} 必须是有效的日期时间`,
      400
    );
  }

  return date;
}

export function parseSelectionParams(
  queryParams: Record<string, string>,
  apiConfig?: Pick<APIConfig, 'selectionParams'> | null,
  now: Date = new Date()
): ParsedSelectionParams {
  const hasTimeWindow = typeof queryParams.timeWindow !== 'undefined';
  const hasTimeStart = typeof queryParams.timeStart !== 'undefined';
  const hasTimeEnd = typeof queryParams.timeEnd !== 'undefined';
  const hasTimeWeight = typeof queryParams.timeWeight !== 'undefined';
  const hasAnyTimeWeightingParam = hasTimeWindow || hasTimeStart || hasTimeEnd || hasTimeWeight;

  if (!hasAnyTimeWeightingParam) {
    return {};
  }

  const config = normalizeSelectionParamsConfig(apiConfig?.selectionParams);
  if (!config.timeWeighting.enabled) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '时间窗口加权参数当前未启用',
      400
    );
  }

  if (hasTimeWindow && (hasTimeStart || hasTimeEnd)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeWindow 不能与 timeStart/timeEnd 同时使用',
      400
    );
  }

  if (!hasTimeWindow && !(hasTimeStart || hasTimeEnd)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      '使用 timeWeight 时必须同时提供 timeWindow 或 timeStart/timeEnd',
      400
    );
  }

  const weight = parseTimeWeight(queryParams.timeWeight);

  if (hasTimeWindow) {
    const parsed = parseRollingWindow(queryParams.timeWindow, now);
    return {
      timeWeighting: {
        start: parsed.start,
        end: parsed.end,
        weight,
        source: 'rolling',
        cacheKey: `${parsed.cacheKey}:weight:${weight}`
      }
    };
  }

  const start = parseFixedDate(queryParams.timeStart, 'timeStart');
  const end = parseFixedDate(queryParams.timeEnd, 'timeEnd');
  if (start > end) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeStart 不能晚于 timeEnd',
      400
    );
  }

  return {
    timeWeighting: {
      start,
      end,
      weight,
      source: 'fixed',
      cacheKey: `fixed:${start.toISOString()}:${end.toISOString()}:weight:${weight}`
    }
  };
}

export function getTimeWeightingCacheKey(timeWeighting?: TimeWeightingOptions): string | undefined {
  return timeWeighting?.cacheKey;
}
