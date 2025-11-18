/**
 * 图片工具函数
 * 提供图片URL处理、缩略图生成等功能
 */

/**
 * 图片接口 (扩展以支持 Telegram 字段)
 */
export interface ImageWithTelegram {
  url: string;
  telegramThumbnailFileId?: string | null;
  telegramThumbnailPath?: string | null;
  telegramBotToken?: string | null;
}

/**
 * 检查是否是 tgState 图片
 */
export function isTgStateImage(url: string): boolean {
  const tgStateBaseUrl = process.env.TGSTATE_BASE_URL;
  if (!tgStateBaseUrl) return false;

  try {
    const tgStateDomain = new URL(tgStateBaseUrl).hostname;
    const urlDomain = new URL(url).hostname;
    return urlDomain === tgStateDomain;
  } catch {
    return false;
  }
}

/**
 * 将 tgState 图片 URL 转换为代理 URL（如果配置了代理）
 * @param originalUrl 原始 tgState 图片 URL
 * @returns 代理 URL 或原始 URL
 * 
 * @example
 * // 未配置代理时
 * convertTgStateToProxyUrl('https://tg.example.com/d/abc123')
 * // 返回: 'https://tg.example.com/d/abc123'
 * 
 * // 配置代理后 (TGSTATE_PROXY_URL=https://tg-proxy.example.com)
 * convertTgStateToProxyUrl('https://tg.example.com/d/abc123')
 * // 返回: 'https://tg-proxy.example.com/d/abc123'
 */
export function convertTgStateToProxyUrl(originalUrl: string): string {
  // 如果没有原始URL，直接返回
  if (!originalUrl) return originalUrl;

  const proxyUrl = process.env.TGSTATE_PROXY_URL;
  const baseUrl = process.env.TGSTATE_BASE_URL;

  // 如果没配置代理URL，或者没有baseUrl，直接返回原URL
  if (!proxyUrl || !baseUrl) {
    return originalUrl;
  }

  // 如果不是 tgState 图片，直接返回原URL
  if (!isTgStateImage(originalUrl)) {
    return originalUrl;
  }

  try {
    // 提取相对路径
    const urlObj = new URL(originalUrl);
    const relativePath = urlObj.pathname + urlObj.search + urlObj.hash;

    // 拼接代理URL，保留代理路径配置
    const proxyUrlObj = new URL(proxyUrl);
    const basePath = `${proxyUrlObj.origin}${proxyUrlObj.pathname.replace(/\/$/, '')}`;
    const normalizedRelativePath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

    return `${basePath}${normalizedRelativePath}`;
  } catch (error) {
    console.warn('转换 tgState 代理URL失败:', error);
    return originalUrl; // 出错时返回原URL
  }
}

/**
 * 批量转换图片URL为代理URL
 * @param urls 图片URL数组
 * @returns 转换后的URL数组
 */
export function convertTgStateUrlsToProxy(urls: string[]): string[] {
  return urls.map(url => convertTgStateToProxyUrl(url));
}

/**
 * 为图片对象的URL字段应用代理转换
 * @param image 包含url字段的图片对象
 * @returns 转换后的图片对象（不修改原对象）
 */
export function applyProxyToImageUrl<T extends { url: string }>(image: T): T {
  return {
    ...image,
    url: convertTgStateToProxyUrl(image.url)
  };
}

/**
 * 为图片数组批量应用代理转换
 * @param images 图片对象数组
 * @returns 转换后的图片数组
 */
export function applyProxyToImageUrls<T extends { url: string }>(images: T[]): T[] {
  return images.map(image => applyProxyToImageUrl(image));
}

/**
 * 检查是否是 Telegram 图片
 */
export function isTelegramImage(url: string): boolean {
  return url.includes('api.telegram.org/file/bot') || url.includes('/api/telegram/image?file_id=');
}

/**
 * 生成 Telegram thumbnail URL (使用 file_id)
 * @param fileId Telegram file_id
 * @returns 代理 API URL
 */
export function getTelegramThumbnailUrl(fileId: string): string {
  // 使用我们的代理 API 来获取 Telegram 图片
  return `/api/telegram/image?file_id=${encodeURIComponent(fileId)}`;
}

/**
 * 为图片生成缩略图 URL (智能选择策略)
 * @param image 图片对象 (可能包含 Telegram 信息)
 * @param size 缩略图尺寸
 * @returns 缩略图 URL
 */
export function generateThumbnailUrlForImage(
  image: ImageWithTelegram,
  size: number = 300
): string {
  // 优先使用 Telegram thumbnail (如果有 file_id)
  if (image.telegramThumbnailFileId) {
    return getTelegramThumbnailUrl(image.telegramThumbnailFileId);
  }

  // 否则使用原有逻辑
  return generateThumbnailUrl(image.url, size);
}

export function generateThumbnailUrl(originalUrl: string, size: number = 300): string {
  // 对于 Telegram 图片，直接返回原始/代理 URL，交给 next/image 处理，避免二次包裹
  if (isTelegramImage(originalUrl)) {
    return originalUrl;
  }

  // 检查是否是 tgState URL
  if (isTgStateImage(originalUrl)) {
    // 直接返回原始/代理 URL，交由 next/image 优化，避免嵌套
    return originalUrl;
  }

  // 检查是否是Cloudinary URL
  if (!originalUrl.includes('res.cloudinary.com')) {
    return originalUrl; // 如果不是Cloudinary URL，返回原URL
  }

  try {
    // Cloudinary URL格式: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}
    const url = new URL(originalUrl);
    const pathParts = url.pathname.split('/');

    // 找到 'upload' 的位置
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) {
      return originalUrl; // 如果不是标准格式，返回原URL
    }

    // 构建缩略图转换参数
    const transformations = `w_${size},h_${size},c_fill,q_auto,f_webp`;

    // 插入转换参数
    const newPathParts = [
      ...pathParts.slice(0, uploadIndex + 1),
      transformations,
      ...pathParts.slice(uploadIndex + 1)
    ];

    // 重新构建URL，确保使用HTTPS
    url.pathname = newPathParts.join('/');
    url.protocol = 'https:';
    return url.toString();
  } catch (error) {
    console.warn('生成缩略图URL失败:', error);
    return originalUrl; // 出错时返回原URL
  }
}

/**
 * 从Cloudinary URL生成不同尺寸的图片URL
 * @param originalUrl 原始图片URL
 * @param width 宽度
 * @param height 高度（可选，默认与宽度相同）
 * @param crop 裁剪模式（默认'fill'）
 * @returns 转换后的图片URL
 */
export function generateResizedUrl(
  originalUrl: string,
  width: number,
  height?: number,
  crop: string = 'fill'
): string {
  // 检查是否是 tgState URL
  if (isTgStateImage(originalUrl)) {
    // 对于 tgState 图片，使用 Next.js 图片优化 API
    const params = new URLSearchParams({
      url: originalUrl,
      w: width.toString(),
      q: '75'
    });
    return `/_next/image?${params.toString()}`;
  }

  if (!originalUrl.includes('res.cloudinary.com')) {
    return originalUrl;
  }

  try {
    const url = new URL(originalUrl);
    const pathParts = url.pathname.split('/');
    
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) {
      return originalUrl;
    }

    // 构建转换参数
    const h = height || width;
    const transformations = `w_${width},h_${h},c_${crop},q_auto,f_webp`;
    
    const newPathParts = [
      ...pathParts.slice(0, uploadIndex + 1),
      transformations,
      ...pathParts.slice(uploadIndex + 1)
    ];

    url.pathname = newPathParts.join('/');
    return url.toString();
  } catch (error) {
    console.warn('生成调整尺寸URL失败:', error);
    return originalUrl;
  }
}

/**
 * 为 tgState 图片生成优化的 URL
 * @param originalUrl 原始 tgState 图片 URL
 * @param width 目标宽度
 * @param quality 图片质量 (1-100)
 * @returns 优化后的图片 URL
 */
export function generateTgStateOptimizedUrl(
  originalUrl: string,
  width: number = 300,
  quality: number = 75
): string {
  if (!isTgStateImage(originalUrl)) {
    return originalUrl;
  }

  const params = new URLSearchParams({
    url: originalUrl,
    w: width.toString(),
    q: quality.toString()
  });

  return `/_next/image?${params.toString()}`;
}

/**
 * 获取图片的多种尺寸 URL
 * @param originalUrl 原始图片 URL
 * @returns 包含不同尺寸的 URL 对象
 */
export function getImageUrls(originalUrl: string) {
  if (isTgStateImage(originalUrl)) {
    return {
      thumbnail: generateTgStateOptimizedUrl(originalUrl, IMAGE_SIZES.thumbnail, 70),
      small: generateTgStateOptimizedUrl(originalUrl, IMAGE_SIZES.small, 75),
      medium: generateTgStateOptimizedUrl(originalUrl, IMAGE_SIZES.medium, 80),
      large: generateTgStateOptimizedUrl(originalUrl, IMAGE_SIZES.large, 85),
      preview: generateTgStateOptimizedUrl(originalUrl, IMAGE_SIZES.preview, 75),
      original: originalUrl
    };
  }

  // 对于 Cloudinary 图片，使用原有逻辑
  return {
    thumbnail: generateThumbnailUrl(originalUrl, IMAGE_SIZES.thumbnail),
    small: generateThumbnailUrl(originalUrl, IMAGE_SIZES.small),
    medium: generateThumbnailUrl(originalUrl, IMAGE_SIZES.medium),
    large: generateThumbnailUrl(originalUrl, IMAGE_SIZES.large),
    preview: generateThumbnailUrl(originalUrl, IMAGE_SIZES.preview),
    original: originalUrl
  };
}

/**
 * 预定义的图片尺寸
 */
export const IMAGE_SIZES = {
  thumbnail: 150,    // 缩略图
  small: 300,        // 小图
  medium: 600,       // 中图
  large: 1200,       // 大图
  preview: 400       // 预览图
} as const;


