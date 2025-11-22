/**
 * 图片处理工具
 * 提供图片透明度调整等功能
 */

import sharp from 'sharp';
import { logger } from './logger';

/**
 * 透明度处理选项
 */
export interface TransparencyOptions {
  /** 透明度值 (0-1.0)，0表示完全透明，1表示完全不透明 */
  opacity: number;
  /** 背景颜色 */
  bgColor: string;
}

export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'gif';
export type ResizeFit = 'cover' | 'contain';

export const OUTPUT_MIME_MAP: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
};

/**
 * 颜色预设
 */
const COLOR_PRESETS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
};

/**
 * 解析背景颜色
 * 支持预设名称（white, black）和十六进制颜色值
 */
function parseBackgroundColor(color: string): string {
  const normalizedColor = color.toLowerCase().trim();
  
  // 检查是否是预设颜色
  if (COLOR_PRESETS[normalizedColor]) {
    return COLOR_PRESETS[normalizedColor];
  }
  
  // 处理十六进制颜色（添加 # 如果缺失）
  if (/^[0-9a-f]{6}$/i.test(normalizedColor)) {
    return `#${normalizedColor}`;
  }
  
  if (/^#[0-9a-f]{6}$/i.test(normalizedColor)) {
    return normalizedColor;
  }
  
  // 默认返回白色
  logger.warn('无效的背景颜色，使用默认白色', { color });
  return COLOR_PRESETS.white;
}

/**
 * 调整图片透明度
 * 将图片与指定背景颜色合成，并应用透明度
 * 
 * @param imageBuffer 原始图片数据
 * @param options 透明度选项
 * @returns 处理后的图片数据和MIME类型
 */
export async function adjustImageTransparency(
  imageBuffer: Buffer,
  options: TransparencyOptions
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const { opacity, bgColor } = options;
    
    // 验证透明度值
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    if (clampedOpacity !== opacity) {
      logger.warn('透明度值超出范围，已限制在 0-1 之间', { 
        original: opacity, 
        clamped: clampedOpacity 
      });
    }
    
    // 解析背景颜色
    const backgroundColor = parseBackgroundColor(bgColor);
    
    logger.info('开始处理图片透明度', {
      type: 'image_processing',
      opacity: clampedOpacity,
      bgColor: backgroundColor
    });
    
    // 获取原始图片信息
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('无法获取图片尺寸');
    }
    
    // 创建背景层（使用背景颜色）
    const background = sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: backgroundColor
      }
    });
    
    // 将原图转换为PNG并应用透明度
    const foreground = await sharp(imageBuffer)
      .ensureAlpha()
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(clampedOpacity * 255)]),
        raw: {
          width: 1,
          height: 1,
          channels: 4
        },
        tile: true,
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();
    
    // 合成背景和前景，输出为JPEG格式
    const result = await background
      .composite([{
        input: foreground,
        blend: 'over'
      }])
      .flatten() // 展平图层，移除Alpha通道
      .jpeg({ quality: 90 }) // 输出为JPEG，质量90
      .toBuffer();
    
    logger.info('图片透明度处理完成', {
      type: 'image_processing',
      originalSize: imageBuffer.length,
      processedSize: result.length,
      opacity: clampedOpacity,
      bgColor: backgroundColor
    });
    
    return {
      buffer: result,
      mimeType: 'image/jpeg'
    };
  } catch (error) {
    logger.error('图片透明度处理失败', error as Error, {
      type: 'image_processing',
      options
    });
    throw error;
  }
}

/**
 * 解析透明度参数
 * 
 * @param opacityStr 透明度字符串（0-1.0）
 * @param bgColorStr 背景颜色字符串
 * @returns 解析后的透明度选项，如果参数无效则返回 null
 */
export function parseTransparencyParams(
  opacityStr?: string,
  bgColorStr?: string
): TransparencyOptions | null {
  // 如果没有提供任何参数，返回 null（不处理）
  if (!opacityStr && !bgColorStr) {
    return null;
  }
  
  // 解析透明度
  let opacity = 1.0; // 默认完全不透明
  if (opacityStr) {
    const parsed = parseFloat(opacityStr);
    if (isNaN(parsed) || parsed < 0 || parsed > 1) {
      logger.warn('无效的透明度参数', { opacity: opacityStr });
      return null;
    }
    opacity = parsed;
  }
  
  // 解析背景颜色，默认白色
  const bgColor = bgColorStr || 'white';
  
  return {
    opacity,
    bgColor
  };
}

function clampQuality(value?: number): number | undefined {
  if (typeof value === 'undefined' || Number.isNaN(value)) {
    return undefined;
  }
  return Math.max(1, Math.min(100, Math.round(value)));
}

/**
 * 调整输出图片的格式与质量
 */
export async function convertImageOutput(
  imageBuffer: Buffer,
  options: { format: OutputFormat; quality?: number }
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { format } = options;
  const quality = clampQuality(options.quality);

  let sharpInstance = sharp(imageBuffer);

  switch (format) {
    case 'jpeg':
      sharpInstance = sharpInstance.jpeg({
        quality: quality ?? 90,
        mozjpeg: true,
        chromaSubsampling: '4:4:4'
      });
      break;
    case 'png': {
      const compressionLevel =
        typeof quality === 'number' ? Math.max(0, Math.min(9, Math.round((100 - quality) / 11))) : 6;
      sharpInstance = sharpInstance.png({
        compressionLevel,
        palette: true
      });
      break;
    }
    case 'webp':
      sharpInstance = sharpInstance.webp({
        quality: quality ?? 85,
        smartSubsample: true
      });
      break;
    case 'gif':
      sharpInstance = sharpInstance.gif({
        reoptimise: true
      });
      break;
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }

  const buffer = await sharpInstance.toBuffer();
  return {
    buffer,
    mimeType: OUTPUT_MIME_MAP[format]
  };
}

export async function resizeImage(
  imageBuffer: Buffer,
  options: { width?: number; height?: number; fit?: ResizeFit }
): Promise<{ buffer: Buffer; mimeType?: string }> {
  const { width, height } = options;
  if (!width && !height) {
    return { buffer: imageBuffer, mimeType: undefined };
  }
  const fit = options.fit === 'contain' ? 'contain' : 'cover';
  const { data, info } = await sharp(imageBuffer)
    .resize({
      width,
      height,
      fit
    })
    .toBuffer({ resolveWithObject: true });

  const mimeType = info.format ? OUTPUT_MIME_MAP[info.format as OutputFormat] : undefined;
  return {
    buffer: data,
    mimeType
  };
}
