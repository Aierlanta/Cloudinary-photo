"use client";

import { useState } from "react";
import Image from "next/image";

interface SmartImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  onClick?: () => void;
  onLoad?: () => void;
  sizes?: string;
  width?: number;
  height?: number;
}

/**
 * 智能图片组件
 * 自动检测图片源类型并选择合适的渲染方式
 * - Cloudinary 图片使用 Next.js Image 组件
 * - tgState 图片使用普通 img 标签（因为是重定向链接）
 */
export default function SmartImage({
  src,
  alt,
  fill = false,
  className = "",
  onClick,
  onLoad,
  sizes,
  width,
  height,
}: SmartImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 检查是否是 tgState 图片
  const isTgStateImage = src.includes('state.aierlanta.net');

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
  };

  // 如果是 tgState 图片，使用普通 img 标签
  if (isTgStateImage) {
    return (
      <div className={`relative ${fill ? 'w-full h-full' : ''}`}>
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          className={`${fill ? 'absolute inset-0 w-full h-full' : ''} ${className} transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${onClick ? "cursor-pointer" : ""}`}
          onClick={onClick}
          onLoad={handleLoad}
          onError={handleError}
          style={fill ? { objectFit: 'cover' } : { width, height }}
        />
      </div>
    );
  }

  // 对于 Cloudinary 图片，使用 Next.js Image 组件
  return (
    <div className="relative">
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        } ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
        onLoad={handleLoad}
        sizes={sizes}
      />
    </div>
  );
}
