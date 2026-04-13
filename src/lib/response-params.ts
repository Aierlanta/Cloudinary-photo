import { AppError, ErrorType } from '@/types/errors';
import type {
  APIConfig,
  ManagedResponseFormat,
  ResponseParamsConfig
} from '@/types/models';

export const MANAGED_RESPONSE_FORMATS: ManagedResponseFormat[] = ['jpeg', 'webp'];

export interface ParsedManagedResponseParams {
  requestedFormat?: ManagedResponseFormat;
  requestedQuality?: number;
  hasManagedResponseParams: boolean;
  originRequested: boolean;
}

export type ManagedResponseEndpoint = 'random' | 'response';

export function createDefaultResponseParamsConfig(): ResponseParamsConfig {
  return {
    format: {
      enabled: false,
      allowedValues: [...MANAGED_RESPONSE_FORMATS]
    },
    quality: {
      enabled: false
    },
    defaultWebpDelivery: {
      random: false,
      response: false
    }
  };
}

function parseBooleanQueryValue(raw: string, name: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new AppError(
    ErrorType.VALIDATION_ERROR,
    `${name} 仅支持 true 或 false`,
    400
  );
}

export function normalizeManagedResponseFormat(
  value?: string | null
): ManagedResponseFormat | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg') {
    return 'jpeg';
  }
  if (normalized === 'webp') {
    return 'webp';
  }

  return null;
}

export function normalizeResponseParamsConfig(
  value?: Partial<ResponseParamsConfig> | null
): ResponseParamsConfig {
  const defaults = createDefaultResponseParamsConfig();
  const allowedValues = Array.isArray(value?.format?.allowedValues)
    ? value.format.allowedValues
        .map(item => normalizeManagedResponseFormat(item))
        .filter((item): item is ManagedResponseFormat => Boolean(item))
    : defaults.format.allowedValues;

  return {
    format: {
      enabled: value?.format?.enabled ?? defaults.format.enabled,
      allowedValues: allowedValues.length > 0
        ? [...new Set(allowedValues)]
        : [...defaults.format.allowedValues]
    },
    quality: {
      enabled: value?.quality?.enabled ?? defaults.quality.enabled
    },
    defaultWebpDelivery: {
      random: value?.defaultWebpDelivery?.random ?? defaults.defaultWebpDelivery.random,
      response: value?.defaultWebpDelivery?.response ?? defaults.defaultWebpDelivery.response
    }
  };
}

export function parseManagedQualityValue(raw: string): number {
  const value = raw.trim();
  if (!value) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'quality 参数不能为空',
      400
    );
  }

  if (value.includes('.')) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'quality 小数模式仅支持 0-1 之间的值',
        400
      );
    }
    return Math.max(1, Math.min(100, Math.round(parsed * 100)));
  }

  if (!/^\d+$/.test(value)) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'quality 仅支持 0-1 小数或 1-100 整数',
      400
    );
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
    throw new AppError(
      ErrorType.VALIDATION_ERROR,
      'quality 整数模式仅支持 1-100',
      400
    );
  }

  return Math.round(parsed);
}

export function validateManagedResponseParams(
  queryParams: Record<string, string>,
  apiConfig?: Pick<APIConfig, 'responseParams'> | null,
  endpoint: ManagedResponseEndpoint = 'response'
): ParsedManagedResponseParams {
  const config = normalizeResponseParamsConfig(apiConfig?.responseParams);
  const originRequested = typeof queryParams.origin !== 'undefined'
    ? parseBooleanQueryValue(queryParams.origin, 'origin')
    : false;
  const useDefaultWebpDelivery = config.defaultWebpDelivery[endpoint];
  const hasManagedResponseParams =
    typeof queryParams.format !== 'undefined' ||
    typeof queryParams.quality !== 'undefined' ||
    (useDefaultWebpDelivery && !originRequested);

  let requestedFormat: ManagedResponseFormat | undefined;
  if (typeof queryParams.format !== 'undefined') {
    if (!config.format.enabled) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'format 参数当前未启用',
        400
      );
    }

    const normalizedFormat = normalizeManagedResponseFormat(queryParams.format);
    if (!normalizedFormat) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'format 仅支持 jpg/jpeg 或 webp',
        400
      );
    }

    if (!config.format.allowedValues.includes(normalizedFormat)) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `format=${normalizedFormat} 当前未开放`,
        400
      );
    }

    requestedFormat = normalizedFormat;
  } else if (useDefaultWebpDelivery && !originRequested) {
    requestedFormat = 'webp';
  }

  let requestedQuality: number | undefined;
  if (typeof queryParams.quality !== 'undefined') {
    if (!config.quality.enabled) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'quality 参数当前未启用',
        400
      );
    }

    requestedQuality = parseManagedQualityValue(queryParams.quality);
  }

  return {
    requestedFormat,
    requestedQuality,
    hasManagedResponseParams,
    originRequested
  };
}

export function getCloudinaryManagedFormat(format: ManagedResponseFormat): 'jpg' | 'webp' {
  return format === 'jpeg' ? 'jpg' : 'webp';
}
