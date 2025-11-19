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
import { useAdminVersion } from "@/contexts/AdminVersionContext";
import { GlassCard, GlassButton } from "@/components/ui/glass";
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
        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
      ) : hasError ? (
        <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center text-gray-500 text-xs">Error</div>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
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

// V2 Preview Modal
function ImagePreviewModal({ image, groups, onClose }: ImagePreviewModalProps) {
  const { version } = useAdminVersion();
  
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

  if (version === 'v2') {
     return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
           <GlassCard className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row" onClick={(e: any) => e.stopPropagation()} noPadding>
              <div className="relative flex-1 bg-black/50 min-h-[300px] flex items-center justify-center p-4">
                 <SmartImage
                    src={isTgStateImage(image.url) ? getImageUrls(image.url).preview : generateThumbnailUrl(image.url, 800)}
                    alt={image.title || image.publicId}
                    fill
                    className="object-contain"
                 />
              </div>
              <div className="w-full md:w-96 p-6 flex flex-col gap-6 overflow-y-auto bg-white/5 border-l border-white/10">
                 <div>
                    <h3 className="text-xl font-bold mb-2 break-all">{image.title || image.publicId}</h3>
                    <p className="text-sm text-muted-foreground">{formatDate(image.uploadedAt)}</p>
                 </div>

                 <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                       <p className="text-xs text-muted-foreground mb-1">Group</p>
                       <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          <span>{group ? group.name : "Ungrouped"}</span>
                       </div>
                    </div>
                    
                    {image.tags && image.tags.length > 0 && (
                       <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-xs text-muted-foreground mb-2">Tags</p>
                          <div className="flex flex-wrap gap-2">
                             {image.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary border border-primary/20">
                                   #{tag}
                                </span>
                             ))}
                          </div>
                       </div>
                    )}

                     <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                       <p className="text-xs text-muted-foreground mb-1">Format</p>
                       <p className="font-mono text-xs break-all">{image.url}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mt-auto">
                    <GlassButton onClick={() => window.open(image.url, "_blank")} className="w-full text-xs">
                       <ExternalLink className="w-4 h-4" /> Open
                    </GlassButton>
                    <GlassButton onClick={() => downloadImage(image.url, image.publicId)} className="w-full text-xs">
                       <Download className="w-4 h-4" /> Save
                    </GlassButton>
                     <GlassButton onClick={() => copyToClipboard(image.url)} className="w-full text-xs">
                       <Copy className="w-4 h-4" /> Link
                    </GlassButton>
                 </div>
              </div>
           </GlassCard>
        </div>
     )
  }

  // Classic V1 Modal (Simplified for brevity, keeping core structure)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
       <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden aspect-square">
                   <SmartImage
                      src={isTgStateImage(image.url) ? getImageUrls(image.url).preview : generateThumbnailUrl(image.url, 400)}
                      alt={image.title || image.publicId}
                      fill
                      className="object-contain"
                   />
                </div>
                <div className="space-y-4">
                   <h3 className="text-lg font-semibold">{image.title || image.publicId}</h3>
                   <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => window.open(image.url, "_blank")} className="bg-blue-600 text-white py-2 rounded">Open</button>
                      <button onClick={() => downloadImage(image.url, image.publicId)} className="bg-purple-600 text-white py-2 rounded">Download</button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

function ImageEditModal({ image, groups, onClose, onSave }: ImageEditModalProps) {
   const { version } = useAdminVersion();
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

   if (version === 'v2') {
      return (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <GlassCard className="w-full max-w-md" onClick={(e: any) => e.stopPropagation()}>
               <h3 className="text-xl font-bold mb-6">Edit Image</h3>
               <div className="space-y-4">
                  <div>
                     <label className="block text-sm font-medium mb-2">Group</label>
                     <select 
                        value={groupId} 
                        onChange={e => setGroupId(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                     >
                        <option value="" className="bg-gray-900">Unassigned</option>
                        {groups.map(g => <option key={g.id} value={g.id} className="bg-gray-900">{g.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-medium mb-2">Tags</label>
                     <input 
                        type="text" 
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        placeholder="Comma separated tags..."
                        className="w-full p-3 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                     />
                  </div>
               </div>
               <div className="flex justify-end gap-3 mt-8">
                  <GlassButton onClick={onClose}>Cancel</GlassButton>
                  <GlassButton primary onClick={handleSave}>Save Changes</GlassButton>
               </div>
            </GlassCard>
         </div>
      )
   }

   // V1 Edit Modal
   return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
         <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Edit Image</h3>
             <div className="space-y-4">
               <select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800">
                  <option value="">Unassigned</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
               </select>
               <input type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-800" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
               <button onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
               <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
         </div>
      </div>
   )
}

export default function ImageList({ images, groups, loading, onDeleteImage, onBulkDelete, onUpdateImage, onBulkUpdate }: ImageListProps) {
  const { t } = useLocale();
  const { version } = useAdminVersion();
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
  const getGroupName = (groupId?: string) => groups.find((g) => g.id === groupId)?.name || "Unassigned";

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) newSelected.delete(imageId);
    else newSelected.add(imageId);
    setSelectedImages(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedImages.size === 0) return;
    if (confirm(`Delete ${selectedImages.size} images?`)) {
      if (onBulkDelete) onBulkDelete(Array.from(selectedImages));
      setSelectedImages(new Set());
      setBulkMode(false);
    }
  };

  const handleBulkUpdateGroup = () => {
    if (selectedImages.size === 0 || !bulkGroupId) return;
    if (confirm(`Move ${selectedImages.size} images?`)) {
      if (onBulkUpdate) onBulkUpdate(Array.from(selectedImages), { groupId: bulkGroupId });
      setSelectedImages(new Set());
      setBulkMode(false);
      setBulkGroupId("");
    }
  };

  const handleUpdateImage = (imageId: string, updates: { groupId?: string; tags?: string[] }) => {
     if (onUpdateImage) onUpdateImage(imageId, updates);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!images?.length) return <div className="p-8 text-center text-muted-foreground">No images found</div>;

  // --- V2 Layout ---
  if (version === 'v2') {
     return (
        <div className="space-y-6">
          <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-4">
             <div className="flex items-center gap-3 flex-wrap">
                 <GlassButton 
                    onClick={() => { setBulkMode(!bulkMode); setSelectedImages(new Set()); }}
                    className={bulkMode ? "bg-primary text-white" : ""}
                 >
                    {bulkMode ? t.adminImages.exitBulkMode : t.adminImages.bulkActions}
                 </GlassButton>
                 {bulkMode && (
                   <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-left-4">
                       <span className="text-sm font-medium">{selectedImages.size} selected</span>
                       <div className="h-6 w-px bg-white/10" />
                       <select 
                          value={bulkGroupId} 
                          onChange={e => setBulkGroupId(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg text-sm p-2 outline-none focus:border-primary"
                       >
                          <option value="" className="bg-gray-900">Move to...</option>
                          {groups.map(g => <option key={g.id} value={g.id} className="bg-gray-900">{g.name}</option>)}
                       </select>
                       <GlassButton primary disabled={!bulkGroupId} onClick={handleBulkUpdateGroup} className="px-3 py-1.5 text-xs">
                          <Move className="w-3 h-3" /> Move
                       </GlassButton>
                       <GlassButton onClick={handleBulkDelete} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20">
                          <Trash2 className="w-3 h-3" /> Delete
                       </GlassButton>
                    </div>
                 )}
              </div>
              <div className="text-sm text-muted-foreground">
                 {images.length} images
              </div>
           </GlassCard>

           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4">
              {images.map(image => (
                <GlassCard
                  key={image.id}
                  noPadding
                  hover={false}
                  className={`group overflow-hidden transition-colors duration-200 ${
                    bulkMode && selectedImages.has(image.id)
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:ring-2 hover:ring-primary/40"
                  }`}
                >
                  <div
                    className="relative aspect-square w-full"
                    onClick={() =>
                      bulkMode ? toggleImageSelection(image.id) : setSelectedImage(image)
                    }
                  >
                    <LazyImage
                      src={
                        isTgStateImage(image.url)
                          ? getImageUrls(image.url).thumbnail
                          : generateThumbnailUrlForImage(image, 400)
                      }
                      alt={image.title || "Image"}
                      className="w-full h-full"
                    />

                    {/* Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                      <p className="text-white text-sm font-medium truncate">
                        {image.title || image.publicId}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-white/60">
                          {formatDate(image.uploadedAt)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingImage(image);
                            }}
                            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteImage(image.id);
                            }}
                            className="p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-200 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {bulkMode && (
                      <div className="absolute top-2 left-2">
                        <div
                          className={`w-5 h-5 rounded-full border border-white/30 flex items-center justify-center transition-colors ${
                            selectedImages.has(image.id)
                              ? "bg-primary border-primary"
                              : "bg-black/40"
                          }`}
                        >
                          {selectedImages.has(image.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))}
           </div>

           <ImagePreviewModal image={selectedImage} groups={groups} onClose={() => setSelectedImage(null)} />
           <ImageEditModal image={editingImage} groups={groups} onClose={() => setEditingImage(null)} onSave={handleUpdateImage} />
        </div>
     )
  }

  // --- Classic V1 Layout ---
  return (
     <>
       <div className="flex justify-between items-center mb-4">
         {/* ... Existing V1 Toolbar ... */}
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
          {/* ... rest of V1 toolbar */}
         </div>
       </div>
       
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
            {/* ... Existing V1 Card Content ... */}
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
              />
              {/* ... V1 hover actions ... */}
            </div>
            <div className="p-3">
               <h3 className="font-medium panel-text truncate mb-1">{image.title || image.publicId}</h3>
               {/* ... V1 details ... */}
            </div>
          </div>
         ))}
       </div>
       
       <ImagePreviewModal image={selectedImage} groups={groups} onClose={() => setSelectedImage(null)} />
       <ImageEditModal image={editingImage} groups={groups} onClose={() => setEditingImage(null)} onSave={handleUpdateImage} />
     </>
  );
}
