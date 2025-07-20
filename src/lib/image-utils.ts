/**
 * 图片工具函数
 * 提供图片URL处理、缩略图生成等功能
 */

/**
 * 从Cloudinary URL生成缩略图URL
 * @param originalUrl 原始图片URL
 * @param size 缩略图尺寸（默认300px）
 * @returns 缩略图URL
 */
export function generateThumbnailUrl(originalUrl: string, size: number = 300): string {
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
 * 预定义的图片尺寸
 */
export const IMAGE_SIZES = {
  thumbnail: 150,    // 缩略图
  small: 300,        // 小图
  medium: 600,       // 中图
  large: 1200,       // 大图
  preview: 400       // 预览图
} as const;

/**
 * 获取不同用途的图片URL
 */
export function getImageUrls(originalUrl: string) {
  return {
    original: originalUrl,
    thumbnail: generateThumbnailUrl(originalUrl, IMAGE_SIZES.thumbnail),
    small: generateThumbnailUrl(originalUrl, IMAGE_SIZES.small),
    medium: generateThumbnailUrl(originalUrl, IMAGE_SIZES.medium),
    large: generateThumbnailUrl(originalUrl, IMAGE_SIZES.large),
    preview: generateThumbnailUrl(originalUrl, IMAGE_SIZES.preview)
  };
}
