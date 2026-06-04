import { AppError, ErrorType } from '@/types/errors';
import type { APIConfig, SelectionParamsConfig } from '@/types/models';

const MAX_TIME_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const TIME_WEIGHT_MIN = 1;
const TIME_WEIGHT_MAX = 100;
const FIXED_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(?:(?:[Zz])|(?:[+-]\d{2}:\d{2}))?)?$/;
const EMBEDDED_TIME_ZONE_PATTERN = /(?:[Zz]|[+-]\d{2}:\d{2})$/;
const OFFSET_TIME_ZONE_PATTERN = /^(?:UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i;

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

function getDaysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

function makeUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): Date {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (year >= 0 && year < 100) {
    date.setUTCFullYear(year);
  }
  return date;
}

function parseOffsetTimeZone(raw: string): { normalized: string; offsetMs: number } | undefined {
  const normalizedRaw = raw.trim();
  if (/^(?:Z|UTC)$/i.test(normalizedRaw)) {
    return {
      normalized: 'UTC',
      offsetMs: 0
    };
  }

  const match = normalizedRaw.match(OFFSET_TIME_ZONE_PATTERN);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[2]);
  const minutes = typeof match[3] === 'undefined' ? 0 : Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeZone 必须是有效的 IANA 时区或 UTC 偏移量',
      400
    );
  }

  const sign = match[1] === '-' ? -1 : 1;
  return {
    normalized: `${sign < 0 ? '-' : '+'}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    offsetMs: sign * ((hours * 60 + minutes) * 60 * 1000)
  };
}

function normalizeFixedTimeZone(raw: string | undefined): string | undefined {
  if (typeof raw === 'undefined' || raw.trim() === '') {
    return undefined;
  }

  const normalized = raw.trim();
  const offset = parseOffsetTimeZone(normalized);
  if (offset) {
    return offset.normalized;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
    return normalized;
  } catch {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeZone 必须是有效的 IANA 时区或 UTC 偏移量',
      400
    );
  }
}

function getTimeZoneParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number(value) : NaN;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second')
  };
}

function getIanaTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = makeUtcDate(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  ).getTime();
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function parseFixedDateInTimeZone(
  components: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  },
  timeZone: string
): Date {
  const offset = parseOffsetTimeZone(timeZone);
  const localUtcMs = makeUtcDate(
    components.year,
    components.month,
    components.day,
    components.hour,
    components.minute,
    components.second,
    components.millisecond
  ).getTime();

  if (offset) {
    return new Date(localUtcMs - offset.offsetMs);
  }

  let offsetMs = getIanaTimeZoneOffsetMs(timeZone, new Date(localUtcMs));
  let result = new Date(localUtcMs - offsetMs);
  const adjustedOffsetMs = getIanaTimeZoneOffsetMs(timeZone, result);
  if (adjustedOffsetMs !== offsetMs) {
    result = new Date(localUtcMs - adjustedOffsetMs);
  }

  const roundTrip = getTimeZoneParts(result, timeZone);
  if (
    roundTrip.year !== components.year ||
    roundTrip.month !== components.month ||
    roundTrip.day !== components.day ||
    roundTrip.hour !== components.hour ||
    roundTrip.minute !== components.minute ||
    roundTrip.second !== components.second
  ) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeZone 下的固定时间窗口包含不存在的本地时间',
      400
    );
  }

  return result;
}

function parseFixedDate(raw: string | undefined, name: string, timeZone?: string): Date {
  if (typeof raw === 'undefined' || raw.trim() === '') {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `固定时间窗口必须同时提供 ${name}`,
      400
    );
  }

  const normalized = raw.trim();
  const match = normalized.match(FIXED_DATE_PATTERN);
  if (!match) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${name} 必须是有效的日期时间`,
      400
    );
  }

  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond] = match;
  const rawMillisecond = match[7];
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const hour = typeof rawHour === 'undefined' ? 0 : Number(rawHour);
  const minute = typeof rawMinute === 'undefined' ? 0 : Number(rawMinute);
  const second = typeof rawSecond === 'undefined' ? 0 : Number(rawSecond);
  const millisecond = typeof rawMillisecond === 'undefined'
    ? 0
    : Number(rawMillisecond.slice(1).padEnd(3, '0'));
  const daysInMonth = getDaysInMonth(year, month);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${name} 必须是有效的日期时间`,
      400
    );
  }

  if (timeZone && EMBEDDED_TIME_ZONE_PATTERN.test(normalized)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      `${name} 已包含时区时不能同时提供 timeZone`,
      400
    );
  }

  if (timeZone) {
    return parseFixedDateInTimeZone({
      year,
      month,
      day,
      hour,
      minute,
      second,
      millisecond
    }, timeZone);
  }

  const date = new Date(normalized);
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
  const hasTimeZone = typeof queryParams.timeZone !== 'undefined';
  const hasAnyTimeWeightingParam = hasTimeWindow || hasTimeStart || hasTimeEnd || hasTimeWeight || hasTimeZone;

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

  if (hasTimeWindow && hasTimeZone) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'timeZone 只能与 timeStart/timeEnd 固定时间窗口一起使用',
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

  const timeZone = normalizeFixedTimeZone(queryParams.timeZone);
  const start = parseFixedDate(queryParams.timeStart, 'timeStart', timeZone);
  const end = parseFixedDate(queryParams.timeEnd, 'timeEnd', timeZone);
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
