"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useImagePreload } from "@/hooks/useImagePreloader";

interface PreloadedImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  onClick?: () => void;
  onLoad?: () => void;
  sizes?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  /**
   * 是否启用预加载
   */
  enablePreload?: boolean;
  /**
   * 预加载的图片URL（通常是下一张图片）
   */
  preloadUrls?: string[];
  /**
   * 加载失败时的回退图片
   */
  fallbackSrc?: string;
}

/**
 * 带预加载功能的智能图片组件
 * 支持图片预加载、错误处理和性能优化
 */
export default function PreloadedImage({
  src,
  alt,
  fill = false,
  className = "",
  onClick,
  onLoad,
  sizes,
  width,
  height,
  priority = false,
  enablePreload = true,
  preloadUrls = [],
  fallbackSrc,
}: PreloadedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const retryCount = useRef(0);
  const maxRetries = 2;

  // 预加载当前图片
  const isPreloaded = useImagePreload(src, enablePreload);

  // 预加载其他图片
  useEffect(() => {
    if (!enablePreload || preloadUrls.length === 0) return;

    preloadUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, [preloadUrls, enablePreload]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    retryCount.current = 0;
    onLoad?.();
  };

  const handleError = () => {
    console.warn(`图片加载失败: ${currentSrc}`);
    
    // 尝试重试
    if (retryCount.current < maxRetries) {
      retryCount.current++;
      setTimeout(() => {
        setCurrentSrc(`${src}?retry=${retryCount.current}`);
      }, 1000 * retryCount.current);
      return;
    }

    // 使用回退图片
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }

    setHasError(true);
  };

  // 当src改变时重置状态
  useEffect(() => {
    setCurrentSrc(src);
    setIsLoaded(false);
    setHasError(false);
    retryCount.current = 0;
  }, [src]);

  return (
    <div className="relative">
      {/* 加载状态指示器 */}
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

      {/* 错误状态 */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg
              className="w-12 h-12 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-sm">图片加载失败</p>
          </div>
        </div>
      )}

      {/* 实际图片 */}
      {!hasError && (
        <Image
          src={currentSrc}
          alt={alt}
          fill={fill}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          className={`${className} transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${onClick ? "cursor-pointer" : ""}`}
          onClick={onClick}
          onLoad={handleLoad}
          onError={handleError}
          sizes={sizes}
          priority={priority}
          quality={75}
          // 如果图片已预加载，可以跳过Next.js的优化
          unoptimized={false}
        />
      )}
    </div>
  );
}

/**
 * 图片预加载工具函数
 * 用于批量预加载图片
 */
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.allSettled(
    urls.map(url => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
        img.src = url;
      });
    })
  );
}
