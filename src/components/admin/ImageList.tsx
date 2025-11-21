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
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Check, 
  Move, 
  Layers, 
  Tag, 
  ExternalLink,
  Download,
  Copy
} from "lucide-react";

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

// ... ImagePreviewModalProps, ImageEditModalProps ... (Reuse existing or redefine)
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

// LazyImage Component (Shared)
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
  const isLight = useTheme();
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
        rootMargin: "50px",
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
          <div className="text-center text-gray-500 text-xs">Error</div>
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
          />
        </>
      )}
    </div>
  );
}

function ImagePreviewModal({ image, groups, onClose }: ImagePreviewModalProps) {
  const { t } = useLocale();
  const isLight = useTheme();
  
  if (!image) return null;

  const group = groups.find((g) => g.id === image.groupId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Basic notification logic (can be improved with toast)
    alert("Copied to clipboard");
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
      console.error("Download failed:", error);
      alert("Download failed");
    }
  };

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 !mt-0" onClick={onClose}>
        <div className={cn(
          "border max-w-4xl w-full max-h-[90vh] overflow-y-auto",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )} onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={cn(
                "relative overflow-hidden aspect-square",
                isLight ? "bg-gray-100 border border-gray-300" : "bg-gray-800 border border-gray-600"
              )}>
                <SmartImage
                  src={isTgStateImage(image.url) ? getImageUrls(image.url).preview : generateThumbnailUrl(image.url, 400)}
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
                    onClick={() => window.open(image.url, "_blank")}
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
                    onClick={() => downloadImage(image.url, image.publicId)}
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
                    onClick={() => copyToClipboard(image.url)}
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
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 !mt-0" onClick={onClose}>
            <div className={cn(
               "border max-w-md w-full",
               isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
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
      )
}

export default function ImageList({ images, groups, loading, onDeleteImage, onBulkDelete, onUpdateImage, onBulkUpdate }: ImageListProps) {
  const { t } = useLocale();
  const isLight = useTheme();
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");

  const { triggerPrewarming } = useImageCachePrewarming(images, {
    enabled: true,
    maxImages: 20,
    delay: 2000,
    onIdle: true,
    thumbnailSize: 300,
  });

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("zh-CN");
  const getGroupName = (groupId?: string) => groups.find((g) => g.id === groupId)?.name || t.adminImages.unassigned;

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) newSelected.delete(imageId);
    else newSelected.add(imageId);
    setSelectedImages(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedImages.size === 0) return;
    if (confirm(t.adminImages.deleteImagesConfirm.replace('{count}', selectedImages.size.toString()))) {
      if (onBulkDelete) onBulkDelete(Array.from(selectedImages));
      setSelectedImages(new Set());
      setBulkMode(false);
    }
  };

  const handleBulkUpdateGroup = () => {
    if (selectedImages.size === 0 || !bulkGroupId) return;
    if (confirm(t.adminImages.moveImagesConfirm.replace('{count}', selectedImages.size.toString()))) {
      if (onBulkUpdate) onBulkUpdate(Array.from(selectedImages), { groupId: bulkGroupId });
      setSelectedImages(new Set());
      setBulkMode(false);
      setBulkGroupId("");
    }
  };

  const handleUpdateImage = (imageId: string, updates: { groupId?: string; tags?: string[] }) => {
     if (onUpdateImage) onUpdateImage(imageId, updates);
  };

  if (loading) return <div className="p-8 text-center">{t.common.loading}</div>;
  if (!images?.length) return <div className="p-8 text-center text-muted-foreground">{t.adminImages.noImagesFound}</div>;

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedImages(new Set());
              }}
              className={cn(
                "px-4 py-2 border transition-colors",
                bulkMode
                  ? isLight
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-blue-600 text-white border-blue-500"
                  : isLight
                  ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                  : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
              )}
            >
              {bulkMode ? t.adminImages.exitBulkMode : t.adminImages.bulkActions}
            </button>
            {bulkMode && selectedImages.size > 0 && (
              <>
                <button
                  onClick={() => onBulkDelete && onBulkDelete(Array.from(selectedImages))}
                  className={cn(
                    "px-4 py-2 border transition-colors",
                    isLight
                      ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                      : "bg-red-600 text-white border-red-500 hover:bg-red-700"
                  )}
                >
                  {t.common.delete} ({selectedImages.size})
                </button>
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
                {bulkGroupId && (
                  <button
                    onClick={() => {
                      onBulkUpdate && onBulkUpdate(Array.from(selectedImages), { groupId: bulkGroupId });
                      setBulkGroupId("");
                      setSelectedImages(new Set());
                    }}
                    className={cn(
                      "px-4 py-2 border transition-colors",
                      isLight
                        ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                    )}
                  >
                    {t.common.confirm}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
            <p>{t.adminGroups.noImagesInGroup || '暂无图片'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "border overflow-hidden transition-colors",
                  bulkMode && selectedImages.has(image.id)
                    ? isLight
                      ? "border-blue-500"
                      : "border-blue-400"
                    : isLight
                    ? "bg-white border-gray-300 hover:bg-gray-50"
                    : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                )}
              >
                <div className={cn(
                  "aspect-square relative",
                  isLight ? "bg-gray-100" : "bg-gray-800"
                )}>
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
                  />
                  {bulkMode && selectedImages.has(image.id) && (
                    <div className={cn(
                      "absolute inset-0 flex items-center justify-center pointer-events-none",
                      isLight ? "bg-blue-500/20" : "bg-blue-600/20"
                    )}>
                      <div className={cn(
                        "w-8 h-8 flex items-center justify-center border-2",
                        isLight
                          ? "bg-blue-500 border-blue-600"
                          : "bg-blue-600 border-blue-500"
                      )}>
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3">
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
                </div>
              </div>
            ))}
          </div>
        )}

        <ImagePreviewModal image={selectedImage} groups={groups} onClose={() => setSelectedImage(null)} />
        <ImageEditModal image={editingImage} groups={groups} onClose={() => setEditingImage(null)} onSave={handleUpdateImage} />
      </div>
    );
}
