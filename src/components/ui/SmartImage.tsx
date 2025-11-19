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
  onError?: () => void;
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
  onError,
  sizes,
  width,
  height,
}: SmartImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [useNativeImage, setUseNativeImage] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    if (!useNativeImage) {
      // 如果 Next.js Image 加载失败，回退到原生 img
      setUseNativeImage(true);
      setIsLoaded(false);
    } else {
      setHasError(true);
      setIsLoaded(true); // 停止加载动画，显示错误或空白
      onError?.();
    }
  };

  const sharedClassName = `${className} transition-opacity duration-300 ${
    isLoaded && !hasError ? "opacity-100" : "opacity-0"
  } ${onClick ? "cursor-pointer" : ""}`;

  return (
    <>
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
      {useNativeImage ? (
        (() => {
          const resolvedWidth = width ? `${width}px` : "100%";
          const resolvedHeight = height ? `${height}px` : "100%";
          return (
        <img
          src={src}
          alt={alt}
          className={sharedClassName}
          onClick={onClick}
          onLoad={handleLoad}
          onError={onError}
          style={
            fill
              ? { objectFit: "cover", width: "100%", height: "100%" }
              : { width: resolvedWidth, height: resolvedHeight, objectFit: "cover" }
          }
        />
          );
        })()
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          className={sharedClassName}
          onClick={onClick}
          onLoad={handleLoad}
          onError={handleError}
          sizes={sizes || "100vw"}
          unoptimized
        />
      )}
    </>
  );
}
