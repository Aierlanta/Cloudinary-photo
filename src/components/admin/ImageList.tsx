"use client";

import { useState, useRef, useEffect } from "react";
import {
  generateThumbnailUrl,
  generateThumbnailUrlForImage,
  getImageUrls,
  isTgStateImage,
} from "@/lib/image-utils";
import SmartImage from "@/components/ui/SmartImage";
import { useImageCachePrewarming } from "@/hooks/useImageCachePrewarming";
import { useLocale } from "@/hooks/useLocale";

interface ImageItem {
  id: string;
  publicId: string;
  url: string;
  title?: string;
  description?: string;
  groupId?: string;
  uploadedAt: string;
  tags?: string[];
  primaryProvider?: string; // 新增:主要图床提供商
  backupProvider?: string; // 新增:备用图床提供商
  // Telegram 相关字段
  telegramFileId?: string | null;
  telegramThumbnailFileId?: string | null;
  telegramFilePath?: string | null;
  telegramThumbnailPath?: string | null;
  telegramBotToken?: string | null;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  imageCount: number;
}

interface ImageListProps {
  images: ImageItem[];
  groups: Group[];
  loading: boolean;
  onDeleteImage: (imageId: string) => void;
  onBulkDelete?: (imageIds: string[]) => void;
  onUpdateImage?: (
    imageId: string,
    updates: { groupId?: string; tags?: string[] }
  ) => void;
  onBulkUpdate?: (
    imageIds: string[],
    updates: { groupId?: string; tags?: string[] }
  ) => void;
}

interface ImagePreviewModalProps {
  image: ImageItem | null;
  groups: Group[];
  onClose: () => void;
}

interface ImageEditModalProps {
  image: ImageItem | null;
  groups: Group[];
  onClose: () => void;
  onSave: (
    imageId: string,
    updates: { groupId?: string; tags?: string[] }
  ) => void;
}

// 增强的懒加载图片组件
function LazyImage({
  src,
  alt,
  className,
  onClick,
  preloadUrls = [],
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  preloadUrls?: string[];
}) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px", // 提前50px开始加载
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 预加载相关图片
  useEffect(() => {
    if (isInView && preloadUrls.length > 0) {
      preloadUrls.forEach((url) => {
        const img = new window.Image();
        img.src = url;
      });
    }
  }, [isInView, preloadUrls]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {!isInView ? (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
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
      ) : hasError ? (
        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-1"
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
            <p className="text-xs">加载失败</p>
          </div>
        </div>
      ) : (
        <>
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          <SmartImage
            src={src}
            alt={alt}
            fill
            className="object-cover"
            onClick={onClick}
            onLoad={handleLoad}
            onError={handleError}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
        </>
      )}
    </div>
  );
}

// 图片预览模态框
function ImagePreviewModal({ image, groups, onClose }: ImagePreviewModalProps) {
  if (!image) return null;

  const group = groups.find((g) => g.id === image.groupId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // 使用浏览器原生通知或简单的视觉反馈
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("已复制到剪贴板", {
        body: text.length > 50 ? text.substring(0, 50) + "..." : text,
        icon: "/favicon.ico",
      });
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("下载失败:", error);
      alert("下载失败，请重试");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold panel-text">图片详情</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 图片预览 */}
            <div className="space-y-4">
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden aspect-square">
                <SmartImage
                  src={isTgStateImage(image.url) ? getImageUrls(image.url).preview : generateThumbnailUrl(image.url, 400)}
                  alt={image.title || image.publicId}
                  fill
                  className="object-contain"
                />
              </div>

              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => window.open(image.url, "_blank")}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  查看原图
                </button>
                <button
                  onClick={() =>
                    downloadImage(image.url, image.publicId + ".jpg")
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  下载图片
                </button>
                <button
                  onClick={() => copyToClipboard(image.url)}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  复制链接
                </button>
                <button
                  onClick={() => copyToClipboard(image.publicId)}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  复制ID
                </button>
              </div>
            </div>

            {/* 图片信息 */}
            <div className="space-y-6">
              <div>
                <h4 className="font-medium panel-text mb-2">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      ID:
                    </span>
                    <span className="panel-text font-mono">{image.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Public ID:
                    </span>
                    <span className="panel-text font-mono">
                      {image.publicId}
                    </span>
                  </div>
                  {image.title && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        标题:
                      </span>
                      <span className="panel-text">{image.title}</span>
                    </div>
                  )}
                  {image.description && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        描述:
                      </span>
                      <span className="panel-text">{image.description}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      上传时间:
                    </span>
                    <span className="panel-text">
                      {formatDate(image.uploadedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium panel-text mb-2">分组信息</h4>
                <div className="text-sm">
                  <span className="panel-text">
                    {group ? group.name : "未分组"}
                  </span>
                  {group?.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>

              {image.tags && image.tags.length > 0 && (
                <div>
                  <h4 className="font-medium panel-text mb-2">标签</h4>
                  <div className="flex flex-wrap gap-1">
                    {image.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium panel-text mb-2">技术信息</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">
                      URL:
                    </span>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs break-all">
                      {image.url}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 图片编辑模态框
function ImageEditModal({
  image,
  groups,
  onClose,
  onSave,
}: ImageEditModalProps) {
  const [groupId, setGroupId] = useState(image?.groupId || "");
  const [tags, setTags] = useState(image?.tags?.join(", ") || "");

  if (!image) return null;

  const handleSave = () => {
    const tagArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    onSave(image.id, {
      groupId: groupId || undefined,
      tags: tagArray.length > 0 ? tagArray : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold panel-text">编辑图片</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* 图片预览 */}
          <div className="mb-4">
            <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
              <SmartImage
                src={generateThumbnailUrl(image.url, 300)}
                alt={image.title || image.publicId}
                fill
                className="object-cover"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 panel-text mt-2 truncate">
              {image.title || image.publicId}
            </p>
          </div>

          {/* 编辑表单 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                分组
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 panel-text"
              >
                <option value="">未分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                标签 (用逗号分隔)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如: 风景, 自然, 美丽"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 panel-text"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 主要的ImageList组件
export default function ImageList({
  images,
  groups,
  loading,
  onDeleteImage,
  onBulkDelete,
  onUpdateImage,
  onBulkUpdate,
}: ImageListProps) {
  const { t } = useLocale();
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");

  // 启用图片缓存预热
  const { triggerPrewarming, getPrewarmingStatus } = useImageCachePrewarming(
    images,
    {
      enabled: true,
      maxImages: 20,
      delay: 2000, // 延迟2秒开始预热
      onIdle: true, // 在空闲时预热
      thumbnailSize: 300,
    }
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN");
  };

  const getGroupName = (groupId?: string) => {
    if (!groupId) return "未分组";
    const group = groups.find((g) => g.id === groupId);
    return group ? group.name : "未知分组";
  };

  // 获取图床提供商显示名称
  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case "cloudinary":
        return "Cloudinary";
      case "tgstate":
        return "tgState";
      default:
        return provider;
    }
  };

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedImages.size === 0) return;

    if (
      confirm(
        `确定要删除选中的 ${selectedImages.size} 张图片吗？此操作不可撤销。`
      )
    ) {
      if (onBulkDelete) {
        onBulkDelete(Array.from(selectedImages));
      }
      setSelectedImages(new Set());
      setBulkMode(false);
    }
  };

  const handleUpdateImage = (
    imageId: string,
    updates: { groupId?: string; tags?: string[] }
  ) => {
    if (onUpdateImage) {
      onUpdateImage(imageId, updates);
    }
  };

  const handleBulkUpdateGroup = () => {
    if (selectedImages.size === 0 || !bulkGroupId) {
      alert("请选择图片和目标分组");
      return;
    }

    if (
      confirm(`确定要将选中的 ${selectedImages.size} 张图片移动到指定分组吗？`)
    ) {
      if (onBulkUpdate) {
        onBulkUpdate(Array.from(selectedImages), { groupId: bulkGroupId });
      }
      setSelectedImages(new Set());
      setBulkMode(false);
      setBulkGroupId("");
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
          >
            <div className="aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!Array.isArray(images) || images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-12 h-12 text-gray-400"
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
        <h3 className="text-lg font-medium panel-text mb-2">暂无图片</h3>
        <p className="text-gray-500 dark:text-gray-400 panel-text">
          还没有上传任何图片，点击上方的上传区域开始添加图片吧！
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 批量操作工具栏 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelectedImages(new Set());
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              bulkMode
                ? "bg-blue-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
          >
            {bulkMode ? t.adminImages.exitBulkMode : t.adminImages.bulkActions}
          </button>

          {bulkMode && selectedImages.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                已选择 {selectedImages.size} 张图片
              </span>

              {/* 批量分组选择器 */}
              <select
                value={bulkGroupId}
                onChange={(e) => setBulkGroupId(e.target.value)}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">选择分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkUpdateGroup}
                disabled={!bulkGroupId}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm transition-colors"
              >
                移动到分组
              </button>

              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
              >
                删除选中
              </button>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          共 {images.length} 张图片
        </div>
      </div>

      {/* 图片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
              bulkMode && selectedImages.has(image.id)
                ? "ring-2 ring-blue-500"
                : ""
            }`}
          >
            {/* 批量选择复选框 */}
            {bulkMode && (
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedImages.has(image.id)}
                  onChange={() => toggleImageSelection(image.id)}
                  className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            {/* 图片预览 */}
            <div className="aspect-square relative bg-gray-100 dark:bg-gray-800">
              <LazyImage
                src={isTgStateImage(image.url) ? getImageUrls(image.url).thumbnail : generateThumbnailUrlForImage(image, 300)}
                alt={image.title || image.publicId}
                className="w-full h-full"
                onClick={() => {
                  if (bulkMode) {
                    toggleImageSelection(image.id);
                  } else {
                    setSelectedImage(image);
                  }
                }}
                preloadUrls={(() => {
                  // 预加载下一张和上一张图片
                  const currentIndex = images.findIndex(
                    (img) => img.id === image.id
                  );
                  const preloadUrls: string[] = [];

                  if (currentIndex > 0) {
                    preloadUrls.push(
                      isTgStateImage(images[currentIndex - 1].url)
                        ? getImageUrls(images[currentIndex - 1].url).thumbnail
                        : generateThumbnailUrlForImage(images[currentIndex - 1], 300)
                    );
                  }
                  if (currentIndex < images.length - 1) {
                    preloadUrls.push(
                      isTgStateImage(images[currentIndex + 1].url)
                        ? getImageUrls(images[currentIndex + 1].url).thumbnail
                        : generateThumbnailUrlForImage(images[currentIndex + 1], 300)
                    );
                  }

                  return preloadUrls;
                })()}
              />

              {/* 悬停操作按钮 */}
              {!bulkMode && (
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(image);
                      }}
                      className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      title="查看详情"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingImage(image);
                      }}
                      className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors"
                      title="编辑图片"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteImage(image.id);
                      }}
                      className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                      title="删除图片"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 图片信息 */}
            <div className="p-3">
              <h3
                className="font-medium panel-text truncate mb-1"
                title={image.title || image.publicId}
              >
                {image.title || image.publicId}
              </h3>

              {/* 基本信息 */}
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="flex items-center truncate">
                    <svg
                      className="w-3 h-3 mr-1 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span className="truncate">
                      {getGroupName(image.groupId)}
                    </span>
                  </span>
                  <span className="flex items-center flex-shrink-0 ml-2">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {formatDate(image.uploadedAt)}
                  </span>
                </div>
              </div>

              {/* 图床信息 */}
              {image.primaryProvider && (
                <div className="mt-1 flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <svg
                    className="w-3 h-3 mr-1 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4"
                    />
                  </svg>
                  <span className="truncate">
                    {getProviderDisplayName(image.primaryProvider)}
                    {image.backupProvider && (
                      <span className="text-green-600 dark:text-green-400 ml-1">
                        (+{getProviderDisplayName(image.backupProvider)})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* 标签 */}
              {image.tags && image.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {image.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {image.tags.length > 3 && (
                    <span className="inline-flex items-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded text-xs">
                      +{image.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* 批量选择状态 */}
              {bulkMode && selectedImages.has(image.id) && (
                <div className="mt-2">
                  <span className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded text-xs">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    已选择
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 模态框 */}
      <ImagePreviewModal
        image={selectedImage}
        groups={groups}
        onClose={() => setSelectedImage(null)}
      />

      <ImageEditModal
        image={editingImage}
        groups={groups}
        onClose={() => setEditingImage(null)}
        onSave={handleUpdateImage}
      />
    </>
  );
}
