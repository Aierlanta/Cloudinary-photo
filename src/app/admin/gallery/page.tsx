"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ImageList from "@/components/admin/ImageList";
import ImageFilters from "@/components/admin/ImageFilters";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Image as ImageIcon, Filter, Grid } from "lucide-react";

interface Image {
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

interface FilterState {
  search: string;
  groupId: string;
  provider: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export default function GalleryPage() {
  const { t } = useLocale();
  const isLight = useTheme();
  const searchParams = useSearchParams();
  const [images, setImages] = useState<Image[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(0);
  const [loadTime, setLoadTime] = useState(0);
  
  // 从 URL 参数中读取 groupId
  const urlGroupId = searchParams?.get("groupId") || "";
  
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    groupId: urlGroupId,
    provider: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 12,
    sortBy: "uploadedAt",
    sortOrder: "desc",
  });
  const [pageInput, setPageInput] = useState("1");

  // Toast通知
  const { toasts, success, error: showError, removeToast } = useToast();
  
  // 当 URL 参数中的 groupId 变化时，更新 filters
  useEffect(() => {
    setFilters((prev) => {
      // 如果 URL 参数中的 groupId 与当前 filters 中的 groupId 不同，则更新
      if (urlGroupId !== prev.groupId) {
        return {
          ...prev,
          groupId: urlGroupId,
          page: 1, // 重置到第一页
        };
      }
      return prev;
    });
  }, [urlGroupId]);

  // 加载分组列表
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await fetch("/api/admin/groups");
        if (response.ok) {
          const data = await response.json();
          const groupsData = data.data?.groups || [];
          setGroups(Array.isArray(groupsData) ? groupsData : []);
        } else {
          console.error("加载分组失败:", response.statusText);
        }
      } catch (error) {
        console.error("加载分组失败:", error);
      }
    };
    loadGroups();
  }, []);

  // 加载图片列表
  useEffect(() => {
    const loadImages = async () => {
      const startTime = performance.now();
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.search) params.append("search", filters.search);
        if (filters.groupId) params.append("groupId", filters.groupId);
        if (filters.provider) params.append("provider", filters.provider);
        if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.append("dateTo", filters.dateTo);
        params.append("page", filters.page.toString());
        params.append("limit", filters.limit.toString());
        params.append("sortBy", filters.sortBy);
        params.append("sortOrder", filters.sortOrder);

        const response = await fetch(`/api/admin/images?${params}`);
        if (response.ok) {
          const data = await response.json();
          const imagesData = data.data?.images;
          setImages(imagesData?.data || []);
          setTotalImages(imagesData?.total || 0);
        } else {
          console.error("加载图片失败:", response.statusText);
        }
      } catch (error) {
        console.error("加载图片失败:", error);
      } finally {
        const endTime = performance.now();
        setLoadTime(Math.round(endTime - startTime));
        setLoading(false);
      }
    };

    loadImages();
  }, [filters]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm(t.adminImages.confirmDelete)) return;

    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFilters((prev) => ({ ...prev }));
      } else {
        showError(t.adminGroups.deleteFailed, t.adminGroups.deleteFailed);
      }
    } catch (error) {
      console.error("删除图片失败:", error);
      showError(t.adminGroups.deleteFailed, t.adminGroups.deleteFailed);
    }
  };

  const handleBulkDelete = async (imageIds: string[]) => {
    try {
      const response = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageIds }),
      });

      if (response.ok) {
        const data = await response.json();
        success(t.adminGroups.deleteSuccess, data.data.message);
        setFilters((prev) => ({ ...prev }));
      } else {
        showError(t.adminGroups.deleteFailed, "批量删除图片失败");
      }
    } catch (error) {
      console.error("批量删除图片失败:", error);
      showError(t.adminGroups.deleteFailed, "批量删除图片失败");
    }
  };

  const handleUpdateImage = async (
    imageId: string,
    updates: { groupId?: string; tags?: string[] }
  ) => {
    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setFilters((prev) => ({ ...prev }));
      } else {
        alert("更新图片失败");
      }
    } catch (error) {
      console.error("更新图片失败:", error);
      alert("更新图片失败");
    }
  };

  const handleBulkUpdate = async (
    imageIds: string[],
    updates: { groupId?: string; tags?: string[] }
  ) => {
    try {
      const response = await fetch("/api/admin/images", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageIds,
          updates,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        success(t.adminGroups.updateSuccess, data.data.message);
        setFilters((prev) => ({ ...prev }));
      } else {
        showError(t.adminGroups.updateFailed, "批量更新图片失败");
      }
    } catch (error) {
      console.error("批量更新图片失败:", error);
      showError(t.adminGroups.updateFailed, "批量更新图片失败");
    }
  };

  const totalPages = Math.ceil(totalImages / filters.limit);
  useEffect(() => {
    setPageInput(filters.page.toString());
  }, [filters.page, totalPages]);

  const handlePageJump = () => {
    const target = Number(pageInput);
    if (!Number.isNaN(target) && target >= 1 && target <= totalPages) {
      handleFilterChange({ page: target });
    }
  };

  const paginationButtons = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    const start = Math.max(1, Math.min(filters.page - 2, totalPages - 4));
    const page = start + i;
    if (page > totalPages) return null;
    return page;
  }).filter(Boolean) as number[];

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto rounded-lg">
      {/* Header */}
      <div className={cn(
        "border p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div>
          <h1 className={cn(
            "text-3xl font-bold flex items-center gap-3 mb-2 rounded-lg",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            <ImageIcon className={cn(
              "w-8 h-8 rounded-lg",
              isLight ? "text-blue-500" : "text-blue-400"
            )} />
            {t.adminGallery?.title || "图库"}
          </h1>
          <p className={cn(
            "text-sm rounded-lg",
            isLight ? "text-gray-600" : "text-gray-400"
          )}>
            {t.adminGallery?.description || "浏览和管理您的图片库"}
          </p>
        </div>
        <div className={cn(
          "flex flex-wrap items-center gap-6 p-4 border rounded-lg",
          isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
        )}>
          <div className="flex items-center gap-3 rounded-lg">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg",
              isLight ? "bg-blue-500" : "bg-blue-600"
            )}>
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-xs rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminImages.totalImages}
              </p>
              <p className={cn(
                "text-xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {totalImages}
              </p>
            </div>
          </div>
          <div className={cn(
            "w-px h-10 rounded-lg",
            isLight ? "bg-gray-300" : "bg-gray-600"
          )} />
          <div className="flex items-center gap-3 rounded-lg">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg",
              isLight ? "bg-green-500" : "bg-green-600"
            )}>
              <Grid className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-xs rounded-lg",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminImages.groupCount}
              </p>
              <p className={cn(
                "text-xl font-bold rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {groups.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={cn(
        "border p-6 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <h2 className={cn(
          "text-lg font-semibold mb-4 flex items-center gap-2 rounded-lg",
          isLight ? "text-gray-900" : "text-gray-100"
        )}>
          <Filter className={cn(
            "w-5 h-5 rounded-lg",
            isLight ? "text-blue-500" : "text-blue-400"
          )} />
          {t.adminImages.filterAndSearch}
        </h2>
        <ImageFilters filters={filters} groups={groups} onFilterChange={handleFilterChange} />
      </div>

      {/* Image List */}
      <div className={cn(
        "border p-6 space-y-6 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-lg">
          <div className="flex items-center gap-3 rounded-lg">
            <h2 className={cn(
              "text-lg font-semibold flex items-center gap-2 rounded-lg",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              <ImageIcon className={cn(
                "w-5 h-5 rounded-lg",
                isLight ? "text-blue-500" : "text-blue-400"
              )} />
              {t.adminImages.imageList}
            </h2>
            <span className={cn(
              "text-sm rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              ({totalImages} {t.adminImages.imagesCount})
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg">
            <span className={cn(
              "text-sm rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              {t.adminImages.itemsPerPage}:
            </span>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange({ limit: parseInt(e.target.value) })}
              className={cn(
                "border text-sm px-3 py-1 outline-none focus:border-blue-500 rounded-lg",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            >
              {[12, 24, 36, 48, 72, 100].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ImageList
          images={images}
          groups={groups}
          loading={loading}
          onDeleteImage={handleDeleteImage}
          onBulkDelete={handleBulkDelete}
          onUpdateImage={handleUpdateImage}
          onBulkUpdate={handleBulkUpdate}
        />

        {totalPages > 1 && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-lg">
            <div className="flex items-center gap-2 flex-wrap rounded-lg">
              <button
                onClick={() => handleFilterChange({ page: filters.page - 1 })}
                disabled={filters.page <= 1}
                className={cn(
                  "px-4 py-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg",
                  isLight
                    ? "bg-white border-gray-300 hover:bg-gray-50 disabled:bg-gray-100"
                    : "bg-gray-800 border-gray-600 hover:bg-gray-700 disabled:bg-gray-900"
                )}
              >
                {t.adminImages.previousPage}
              </button>
              <div className="flex gap-1 flex-wrap rounded-lg">
                {paginationButtons.map((page) => (
                  <button
                    key={page}
                    onClick={() => handleFilterChange({ page })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center transition-colors border rounded-lg",
                      page === filters.page
                        ? isLight
                          ? "bg-blue-500 text-white border-blue-600"
                          : "bg-blue-600 text-white border-blue-500"
                        : isLight
                        ? "bg-white border-gray-300 hover:bg-gray-50"
                        : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleFilterChange({ page: filters.page + 1 })}
                disabled={filters.page >= totalPages}
                className={cn(
                  "px-4 py-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg",
                  isLight
                    ? "bg-white border-gray-300 hover:bg-gray-50 disabled:bg-gray-100"
                    : "bg-gray-800 border-gray-600 hover:bg-gray-700 disabled:bg-gray-900"
                )}
              >
                {t.adminImages.nextPage}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm rounded-lg">
              <span className={isLight ? "text-gray-600" : "text-gray-400"}>
                {t.adminImages.currentPage}:
              </span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePageJump();
                }}
                className={cn(
                  "w-20 px-3 py-2 border outline-none rounded-lg",
                  isLight
                    ? "bg-white border-gray-300 focus:border-blue-500"
                    : "bg-gray-800 border-gray-600 focus:border-blue-500"
                )}
              />
              <button
                onClick={handlePageJump}
                className={cn(
                  "px-3 py-2 border transition-colors rounded-lg",
                  isLight
                    ? "bg-gray-100 border-gray-300 hover:bg-gray-200"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                )}
              >
                GO
              </button>
              <span className={isLight ? "text-gray-600" : "text-gray-400"}>
                / {totalPages}
              </span>
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}

