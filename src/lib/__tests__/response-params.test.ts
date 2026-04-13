import {
  createDefaultResponseParamsConfig,
  normalizeManagedResponseFormat,
  parseManagedQualityValue,
  validateManagedResponseParams
} from '@/lib/response-params';
import { AppError } from '@/types/errors';

describe('response-params', () => {
  it('应提供默认响应参数配置', () => {
    expect(createDefaultResponseParamsConfig()).toEqual({
      format: {
        enabled: false,
        allowedValues: ['jpeg', 'webp']
      },
      quality: {
        enabled: false
      }
    });
  });

  it('应将 jpg 归一化为 jpeg', () => {
    expect(normalizeManagedResponseFormat('jpg')).toBe('jpeg');
    expect(normalizeManagedResponseFormat('jpeg')).toBe('jpeg');
    expect(normalizeManagedResponseFormat('webp')).toBe('webp');
  });

  it('应支持 quality 的 0-1 与 1-100 两种写法', () => {
    expect(parseManagedQualityValue('0.8')).toBe(80);
    expect(parseManagedQualityValue('80')).toBe(80);
    expect(parseManagedQualityValue('1.0')).toBe(100);
  });

  it('应拒绝非法 quality 值', () => {
    expect(() => parseManagedQualityValue('1.2')).toThrow(AppError);
    expect(() => parseManagedQualityValue('101')).toThrow(AppError);
    expect(() => parseManagedQualityValue('abc')).toThrow(AppError);
  });

  it('应按配置校验 format 与 quality 是否启用', () => {
    expect(() => validateManagedResponseParams(
      { format: 'webp' },
      {
        responseParams: {
          format: {
            enabled: false,
            allowedValues: ['jpeg', 'webp']
          },
          quality: {
            enabled: true
          }
        }
      } as any
    )).toThrow(AppError);

    expect(() => validateManagedResponseParams(
      { quality: '80' },
      {
        responseParams: {
          format: {
            enabled: true,
            allowedValues: ['jpeg', 'webp']
          },
          quality: {
            enabled: false
          }
        }
      } as any
    )).toThrow(AppError);
  });
});
