"use client";

import { useState, useRef, useEffect } from "react";
import {
  generateThumbnailUrl,
  generateThumbnailUrlForImage,
  getImageUrls,
  isTgStateImage,
  getEffectiveImageUrl,
} from "@/lib/image-utils";
import SmartImage from "@/components/ui/SmartImage";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useImageCachePrewarming } from "@/hooks/useImageCachePrewarming";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAdminApi } from "@/lib/admin-api-client";
import AdminPortal from "@/components/admin/AdminPortal";
import { Check } from "lucide-react";

interface ImageItem {
  id: string;
  publicId: string;
  url: string;
  title?: string;
  description?: string;
  groupId?: string;
  uploadedAt: string;
  tags?: string[];
  primaryProvider?: string;
  backupProvider?: string;
  ownerNodeId?: string | null;
  previewUrl?: string | null;
  telegramFileId?: string | null;
  telegramThumbnailFileId?: string | null;
  telegramFilePath?: string | null;
  telegramThumbnailPath?: string | null;
  telegramBotToken?: string | null;
  storageMetadata?: string | null;
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
  onDeleteImage: (imageId: string) => Promise<void>;
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

// ... ImagePreviewModalProps, ImageEditModalProps ... (Reuse existing or redefine)
interface ImagePreviewModalProps {
  image: ImageItem | null;
  groups: Group[];
  onClose: () => void;
  onSuccess: (title: string, message?: string) => void;
  onError: (title: string, message?: string) => void;
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

// LazyImage Component (Shared)
function LazyImage({
  src,
  alt,
  className,
  onClick,
  preloadUrls = [],
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  preloadUrls?: string[];
  eager?: boolean;
}) {
  const isLight = useTheme();
  const { t } = useLocale();
  const [isInView, setIsInView] = useState(eager);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eager) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [eager]);

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
        <div className={cn(
          "w-full h-full animate-pulse flex items-center justify-center",
          isLight ? "bg-gray-200" : "bg-gray-800"
        )}>
          <div className={cn(
            "w-8 h-8 rounded-full",
            isLight ? "bg-gray-300" : "bg-gray-600"
          )} />
        </div>
      ) : hasError ? (
        <div className={cn(
          "w-full h-full flex items-center justify-center",
          isLight ? "bg-gray-100" : "bg-gray-800"
        )}>
          <div className="text-center text-gray-500 text-xs">{t.adminUi.error}</div>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div className={cn(
              "absolute inset-0 animate-pulse",
              isLight ? "bg-gray-200" : "bg-gray-700"
            )} />
          )}
          <SmartImage
            src={src}
            alt={alt}
            fill
            className={`object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onClick={onClick}
            onLoad={handleLoad}
            onError={handleError}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            priority={eager}
          />
        </>
      )}
    </div>
  );
}

function ImagePreviewModal({ image, groups, onClose, onSuccess, onError }: ImagePreviewModalProps) {
  const { t, locale } = useLocale();
  const isLight = useTheme();
  const { adminFetch } = useAdminApi();
  
  if (!image) return null;

  const group = groups.find((g) => g.id === image.groupId);
  const previewSrc = image.previewUrl || (isTgStateImage(image.url) ? getImageUrls(image.url).preview : generateThumbnailUrlForImage(image, 400));

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess(
        t.adminImages.copySuccess,
        t.adminImages.copySuccessMessage
      );
    } catch (error) {
      onError(
        t.adminImages.copyFailed,
        t.adminImages.copyFailedMessage
      );
    }
  };

  const parseContentDispositionFilename = (contentDisposition: string): string | null => {
    // 优先解析 RFC 5987 filename*=UTF-8''...（百分号编码，能正确表达特殊字符）
    // 回退解析 filename="..."（支持 \" 与 \\ 转义）

    const splitParams = (value: string): string[] => {
      const parts: string[] = [];
      let current = "";
      let inQuotes = false;
      let escaped = false;

      for (let i = 0; i < value.length; i++) {
        const ch = value[i];

        if (escaped) {
          current += ch;
          escaped = false;
          continue;
        }

        if (inQuotes && ch === "\\") {
          current += ch;
          escaped = true;
          continue;
        }

        if (ch === '"') {
          current += ch;
          inQuotes = !inQuotes;
          continue;
        }

        if (ch === ";" && !inQuotes) {
          const trimmed = current.trim();
          if (trimmed) parts.push(trimmed);
          current = "";
          continue;
        }

        current += ch;
      }

      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      return parts;
    };

    const unquote = (value: string): string => {
      const v = value.trim();
      if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
        return v.slice(1, -1);
      }
      return v;
    };

    const unescapeQuotedString = (value: string): string => {
      // 仅处理常见的 quoted-string 转义：\" 和 \\
      return value.replace(/\\(["\\])/g, "$1");
    };

    const sanitizeFilename = (value: string): string => {
      // 防止奇怪路径/控制字符（即使 header 理论上不会出现，也做兜底）
      return value
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/[\\/]/g, "_")
        .trim();
    };

    const params = splitParams(contentDisposition);
    const kv: Record<string, string> = {};

    for (let i = 1; i < params.length; i++) {
      const part = params[i];
      const eq = part.indexOf("=");
      if (eq <= 0) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      const value = part.slice(eq + 1).trim();
      if (!key) continue;
      kv[key] = value;
    }

    const filenameStar = kv["filename*"];
    if (filenameStar) {
      const raw = unquote(filenameStar);
      // RFC 5987: charset'lang'%xx%yy
      const match = raw.match(/^([^']*)'[^']*'(.*)$/);
      const encodedPart = match ? match[2] : raw;
      try {
        const decoded = decodeURIComponent(encodedPart.replace(/\+/g, "%20"));
        const safe = sanitizeFilename(decoded);
        if (safe) return safe;
      } catch {
        // ignore decode errors and fallback
      }
    }

    const filename = kv["filename"];
    if (filename) {
      const raw = unquote(filename);
      const unescaped = unescapeQuotedString(raw);
      const safe = sanitizeFilename(unescaped);
      if (safe) return safe;
    }

    return null;
  };

  const downloadImage = async (url: string, fallbackFilename: string) => {
     try {
      const response = url.startsWith('/api/')
        ? await adminFetch(url)
        : await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      
      // 尝试从 Content-Disposition 头获取文件名
      let filename = fallbackFilename;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const parsed = parseContentDispositionFilename(contentDisposition);
        if (parsed) filename = parsed;
      }
      // 如果文件名没有扩展名，尝试从 Content-Type 推断
      if (!filename.includes('.')) {
        const contentType = response.headers.get('Content-Type');
        const extMap: Record<string, string> = {
          'image/png': '.png',
          'image/jpeg': '.jpg',
          'image/gif': '.gif',
          'image/webp': '.webp',
        };
        const mime = contentType ? contentType.split(';')[0].trim().toLowerCase() : null;
        const ext = mime ? extMap[mime] || '.png' : '.png';
        filename = `${filename}${ext}`;
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      onError(
        t.adminImages.downloadFailed,
        t.adminImages.downloadFailedMessage
      );
    }
  };

  // --- V3 Layout (Flat Design) ---
  return (
    <AdminPortal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[220] p-4 !mt-0" onClick={onClose}>
        <div className={cn(
          "border max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border-2",
          isLight ? "bg-white border-gray-300" : "bg-[var(--admin-panel,#2a1f3d)] border-[var(--admin-lavender,#a887dd)]"
        )} onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={cn(
                "relative overflow-hidden aspect-square",
                isLight ? "bg-gray-100 border border-gray-300" : "bg-gray-800 border border-gray-600"
              )}>
                <SmartImage
                  src={previewSrc}
                  alt={image.title || image.publicId}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className={cn(
                    "text-lg font-semibold mb-2 truncate",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {image.title || image.publicId}
                  </h3>
                  <p className={cn(
                    "text-sm",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    {formatDate(image.uploadedAt)}
                  </p>
                </div>
                <div className={cn(
                  "p-3 border",
                  isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
                )}>
                  <p className={cn(
                    "text-xs mb-1",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    {t.adminImages.group}
                  </p>
                  <p className={cn(
                    "text-sm",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {group ? group.name : t.adminImages.ungrouped}
                  </p>
                </div>
                <div className={cn(
                  "p-3 border",
                  isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
                )}>
                  <p className={cn(
                    "text-xs mb-1",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    {t.adminUi.galleryOwnerNode}
                  </p>
                  <p className={cn(
                    "text-sm break-all",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {image.ownerNodeId || t.adminUi.unknownOwner}
                  </p>
                </div>
                {image.tags && image.tags.length > 0 && (
                  <div className={cn(
                    "p-3 border",
                    isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
                  )}>
                    <p className={cn(
                      "text-xs mb-2",
                      isLight ? "text-gray-600" : "text-gray-400"
                    )}>
                      {t.adminImages.tags}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {image.tags.map(tag => (
                        <span
                          key={tag}
                          className={cn(
                            "px-2 py-1 text-xs border",
                            isLight
                              ? "bg-blue-50 border-blue-300 text-blue-800"
                              : "bg-blue-900/20 border-blue-600 text-blue-200"
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      const effectiveUrl = getEffectiveImageUrl(image);
                      window.open(effectiveUrl, "_blank");
                    }}
                    className={cn(
                      "px-4 py-2 border transition-colors",
                      isLight
                        ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                    )}
                  >
                    {t.adminImages.open}
                  </button>
                  <button
                    onClick={() => {
                      const effectiveUrl = getEffectiveImageUrl(image);
                      // 跨域资源（tgstate / cloudinary 等）在浏览器侧 fetch 可能失败（CORS/鉴权/未暴露响应头），
                      // 统一走同源 admin 代理下载，避免“下载失败，请重试”。
                      const shouldProxyDownload = (() => {
                        try {
                          const abs = effectiveUrl.startsWith('/')
                            ? new URL(effectiveUrl, window.location.origin)
                            : new URL(effectiveUrl);
                          return abs.origin !== window.location.origin;
                        } catch {
                          // URL 解析失败时，保守回退：tgState 仍走代理
                          return (
                            image.primaryProvider === 'tgstate' ||
                            image.backupProvider === 'tgstate' ||
                            isTgStateImage(image.url)
                          );
                        }
                      })();

                      const url = shouldProxyDownload
                        ? `/api/admin/images/${encodeURIComponent(image.id)}/file?disposition=attachment`
                        : effectiveUrl;

                      downloadImage(url, image.publicId);
                    }}
                    className={cn(
                      "px-4 py-2 border transition-colors",
                      isLight
                        ? "bg-purple-500 text-white border-purple-600 hover:bg-purple-600"
                        : "bg-purple-600 text-white border-purple-500 hover:bg-purple-700"
                    )}
                  >
                    {t.adminImages.download}
                  </button>
                  <button
                    onClick={() => {
                      let effectiveUrl = getEffectiveImageUrl(image);
                      // 如果是相对路径，转换为完整 URL
                      if (effectiveUrl.startsWith('/')) {
                        effectiveUrl = `${window.location.origin}${effectiveUrl}`;
                      }
                      copyToClipboard(effectiveUrl);
                    }}
                    className={cn(
                      "px-4 py-2 border transition-colors col-span-2",
                      isLight
                        ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                        : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                    )}
                  >
                    {t.adminImages.copyLink}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPortal>
    );
  }

function ImageEditModal({ image, groups, onClose, onSave }: ImageEditModalProps) {
   const { t } = useLocale();
   const isLight = useTheme();
   const [groupId, setGroupId] = useState(image?.groupId || "");
   const [tags, setTags] = useState(image?.tags?.join(", ") || "");

   useEffect(() => {
      if (image) {
         setGroupId(image.groupId || "");
         setTags(image.tags?.join(", ") || "");
      }
   }, [image]);

   if (!image) return null;

   const handleSave = () => {
      const tagArray = tags.split(",").map(t => t.trim()).filter(t => t.length > 0);
      onSave(image.id, { groupId: groupId || undefined, tags: tagArray.length > 0 ? tagArray : undefined });
      onClose();
   };

   // --- V3 Layout (Flat Design) ---
   return (
    <AdminPortal>
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[220] p-4 !mt-0" onClick={onClose}>
            <div className={cn(
               "border max-w-md w-full rounded-2xl border-2",
               isLight ? "bg-white border-gray-300" : "bg-[var(--admin-panel,#2a1f3d)] border-[var(--admin-lavender,#a887dd)]"
            )} onClick={e => e.stopPropagation()}>
               <div className="p-6">
                  <h3 className={cn(
                     "text-lg font-bold mb-4",
                     isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                     {t.adminImages.editImage}
                  </h3>
                  <div className="space-y-4">
                     <div>
                        <label className={cn(
                           "block text-sm font-medium mb-2",
                           isLight ? "text-gray-700" : "text-gray-300"
                        )}>
                           {t.adminImages.group}
                        </label>
                        <select
                           value={groupId}
                           onChange={e => setGroupId(e.target.value)}
                           className={cn(
                              "w-full p-2 border outline-none focus:border-blue-500",
                              isLight
                                 ? "bg-white border-gray-300"
                                 : "bg-gray-800 border-gray-600"
                           )}
                        >
                           <option value="">{t.adminImages.unassigned}</option>
                           {groups.map(g => (
                              <option key={g.id} value={g.id}>
                                 {g.name}
                              </option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label className={cn(
                           "block text-sm font-medium mb-2",
                           isLight ? "text-gray-700" : "text-gray-300"
                        )}>
                           {t.adminImages.tags}
                        </label>
                        <input
                           type="text"
                           value={tags}
                           onChange={e => setTags(e.target.value)}
                           placeholder={t.adminImages.commaSeparatedTags}
                           className={cn(
                              "w-full p-2 border outline-none focus:border-blue-500",
                              isLight
                                 ? "bg-white border-gray-300"
                                 : "bg-gray-800 border-gray-600"
                           )}
                        />
                     </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                     <button
                        onClick={onClose}
                        className={cn(
                           "px-4 py-2 border transition-colors",
                           isLight
                              ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                              : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                        )}
                     >
                        {t.common.cancel}
                     </button>
                     <button
                        onClick={handleSave}
                        className={cn(
                           "px-4 py-2 border transition-colors",
                           isLight
                              ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                              : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                        )}
                     >
                        {t.common.save}
                     </button>
                  </div>
               </div>
            </div>
         </div>
    </AdminPortal>
      )
}

export default function ImageList({ images, groups, loading, onDeleteImage, onBulkDelete, onUpdateImage, onBulkUpdate }: ImageListProps) {
  const { t, locale } = useLocale();
  const isLight = useTheme();
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const { toasts, success, error: showToastError, removeToast } = useToast();

  useImageCachePrewarming(images, {
    enabled: true,
    maxImages: 8,
    delay: 3000,
    onIdle: true,
    thumbnailSize: 300,
  });

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US");
  const getGroupName = (groupId?: string) => groups.find((g) => g.id === groupId)?.name || t.adminImages.unassigned;
  const getOwnerNodeLabel = (image: ImageItem) => image.ownerNodeId || t.adminUi.unknownOwner;

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) newSelected.delete(imageId);
    else newSelected.add(imageId);
    setSelectedImages(newSelected);
  };

  const handleEnterBulkMode = () => {
    setBulkMode(true);
    setSelectedImages(new Set());
    setBulkGroupId("");
    setIsGroupPickerOpen(false);
  };

  const handleExitBulkMode = () => {
    setBulkMode(false);
    setSelectedImages(new Set());
    setBulkGroupId("");
    setIsGroupPickerOpen(false);
  };

  const handleSelectAll = () => {
    if (selectedImages.size === images.length && images.length > 0) {
      setSelectedImages(new Set());
      return;
    }
    setSelectedImages(new Set(images.map((image) => image.id)));
  };

  const handleBulkDelete = () => {
    if (selectedImages.size === 0) return;
    if (confirm(t.adminImages.deleteImagesConfirm.replace('{count}', selectedImages.size.toString()))) {
      if (onBulkDelete) onBulkDelete(Array.from(selectedImages));
      handleExitBulkMode();
    }
  };

  const handleDeleteSingleImage = async (imageId: string, imageTitle?: string) => {
    if (confirm(t.adminImages.deleteImageConfirm.replace('{name}', imageTitle || imageId))) {
      try {
        await onDeleteImage(imageId);
        success(t.adminImages.deleteSuccess, t.adminImages.deleteSuccessMessage);
      } catch (error) {
        showToastError(t.adminImages.deleteFailed, t.adminImages.deleteFailedMessage);
      }
    }
  };

  const handleBulkUpdateGroup = () => {
    if (selectedImages.size === 0 || !bulkGroupId) return;
    if (confirm(t.adminImages.moveImagesConfirm.replace('{count}', selectedImages.size.toString()))) {
      if (onBulkUpdate) onBulkUpdate(Array.from(selectedImages), { groupId: bulkGroupId });
      handleExitBulkMode();
    }
  };

  const handleUpdateImage = (imageId: string, updates: { groupId?: string; tags?: string[] }) => {
     if (onUpdateImage) onUpdateImage(imageId, updates);
  };

  if (loading) return <div className="p-8 text-center">{t.common.loading}</div>;
  if (!images?.length) return <div className="p-8 text-center text-muted-foreground">{t.adminImages.noImagesFound}</div>;

  const allImagesSelected = selectedImages.size === images.length;
  const hasSelectedImages = selectedImages.size > 0;

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="admin-gallery-list space-y-4">
        {bulkMode ? (
          <div className="admin-gallery-list-toolbar is-bulk-active flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="admin-gallery-selection-count" aria-live="polite">
                {t.adminImages.selectedImageCount.replace("{count}", selectedImages.size.toString())}
              </span>
              <button type="button" onClick={handleExitBulkMode} className="admin-gallery-bulk-action admin-gallery-bulk-exit">
                <span className="galleryArtwork galleryArtworkClose" aria-hidden="true" />
                {t.adminImages.exitBulkMode}
              </button>
              <button type="button" onClick={handleSelectAll} className="admin-gallery-bulk-action admin-gallery-bulk-select-all">
                <span className="galleryArtwork galleryArtworkChecklist" aria-hidden="true" />
                {allImagesSelected ? t.adminImages.clearSelection : t.adminImages.selectAll}
              </button>
              <button
                type="button"
                onClick={() => setIsGroupPickerOpen((open) => !open)}
                disabled={!hasSelectedImages}
                className="admin-gallery-bulk-action admin-gallery-bulk-move"
              >
                <span className="galleryArtwork galleryArtworkMove" aria-hidden="true" />
                {t.adminImages.moveToGroup}
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={!hasSelectedImages}
                className="admin-gallery-bulk-action admin-gallery-bulk-delete"
              >
                <span className="galleryArtwork galleryArtworkTrash" aria-hidden="true" />
                {t.common.delete}
              </button>
              {isGroupPickerOpen ? (
                <div className="admin-gallery-group-picker">
                  <select
                    value={bulkGroupId}
                    onChange={(e) => setBulkGroupId(e.target.value)}
                    className={cn(
                      "px-3 py-2 border outline-none focus:border-blue-500",
                      isLight
                        ? "bg-white border-gray-300"
                        : "bg-gray-800 border-gray-600"
                    )}
                  >
                    <option value="">{t.adminImages.moveToGroup}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!bulkGroupId || !hasSelectedImages}
                    onClick={handleBulkUpdateGroup}
                    className={cn(
                      "px-4 py-2 border transition-colors",
                      isLight
                        ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                    )}
                  >
                    {t.common.confirm}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="admin-gallery-list-toolbar is-idle flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleEnterBulkMode} className="admin-gallery-bulk-mode-trigger">
                <span className="galleryArtwork galleryArtworkChecklist" aria-hidden="true" />
                {t.adminImages.enterBulkMode}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="admin-gallery-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-square animate-pulse",
                  isLight ? "bg-gray-200" : "bg-gray-700"
                )}
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className={cn(
            "text-center py-12 border",
            isLight
              ? "bg-gray-50 border-gray-300 text-gray-600"
              : "bg-gray-700 border-gray-600 text-gray-400"
          )}>
            <p>{t.adminGroups.noImagesInGroup}</p>
          </div>
        ) : (
          <div className="admin-gallery-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={cn(
                  "admin-gallery-card border overflow-hidden transition-colors relative",
                  bulkMode && "is-bulk-mode",
                  bulkMode && selectedImages.has(image.id) && "is-selected",
                  !bulkMode && (isLight
                    ? "bg-white border-gray-300 hover:bg-gray-50"
                    : "bg-gray-800 border-gray-600 hover:bg-gray-700")
                )}
                onMouseEnter={() => !bulkMode && setHoveredImageId(image.id)}
                onMouseLeave={() => setHoveredImageId(null)}
              >
                <div className={cn(
                  "admin-gallery-photo aspect-square relative",
                  isLight ? "bg-gray-100" : "bg-gray-800"
                )}>
                  <LazyImage
                    src={image.previewUrl || (isTgStateImage(image.url) ? getImageUrls(image.url).thumbnail : generateThumbnailUrlForImage(image, 300))}
                    alt={image.title || image.publicId}
                    className="w-full h-full"
                    eager={index < 8}
                    onClick={() => {
                      if (bulkMode) {
                        toggleImageSelection(image.id);
                      } else {
                        setSelectedImage(image);
                      }
                    }}
                  />
                  {bulkMode ? (
                    <>
                      {selectedImages.has(image.id) ? <span className="admin-gallery-selection-wash" aria-hidden /> : null}
                      <button
                        type="button"
                        className={cn(
                          "admin-gallery-card-selector",
                          selectedImages.has(image.id) && "is-selected"
                        )}
                        aria-label={selectedImages.has(image.id) ? t.adminImages.deselectImage : t.adminImages.selectImage}
                        aria-pressed={selectedImages.has(image.id)}
                        title={selectedImages.has(image.id) ? t.adminImages.deselectImage : t.adminImages.selectImage}
                         onClick={(event) => {
                           event.stopPropagation();
                           toggleImageSelection(image.id);
                         }}
                       >
                        <Check aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                  {!bulkMode && hoveredImageId === image.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSingleImage(image.id, image.title || image.publicId);
                      }}
                      className={cn(
                        "absolute top-2 right-2 p-2 rounded-full transition-all z-10",
                        "hover:scale-110 active:scale-95",
                        isLight
                          ? "bg-red-500 text-white hover:bg-red-600 shadow-lg"
                          : "bg-red-600 text-white hover:bg-red-700 shadow-lg"
                      )}
                       title={t.adminImages.deleteImage}
                     >
                      <span className="galleryArtwork galleryArtworkTrash" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="admin-gallery-caption p-3">
                  <h3 className={cn(
                    "font-medium truncate mb-1",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {image.title || image.publicId}
                  </h3>
                  <div className={cn(
                    "text-xs",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    {formatDate(image.uploadedAt)}
                  </div>
                  <div className="mt-2">
                    <span className={cn(
                      "inline-flex max-w-full px-2 py-0.5 text-[11px] border rounded-lg",
                      isLight
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-blue-900/20 border-blue-700 text-blue-200"
                    )}>
                      <span className="truncate">{t.adminUi.galleryOwnerNode}: {getOwnerNodeLabel(image)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ImagePreviewModal
          image={selectedImage}
          groups={groups}
          onClose={() => setSelectedImage(null)}
          onSuccess={success}
          onError={showToastError}
        />
        <ImageEditModal image={editingImage} groups={groups} onClose={() => setEditingImage(null)} onSave={handleUpdateImage} />
        <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
      </div>
    );
}
