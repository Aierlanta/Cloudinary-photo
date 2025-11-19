"use client";

import { useState, useEffect } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import ImageList from "@/components/admin/ImageList";
import ImageFilters from "@/components/admin/ImageFilters";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { useAdminVersion } from "@/contexts/AdminVersionContext";
import { GlassCard } from "@/components/ui/glass";
import { Image as ImageIcon, Filter, Grid, Database } from "lucide-react";

interface Image {
  id: string;
  publicId: string;
  url: string;
  title?: string;
  description?: string;
  groupId?: string;
  uploadedAt: string;
  tags?: string[];
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

export default function ImagesPage() {
  const { t } = useLocale();
  const { version } = useAdminVersion();
  const [images, setImages] = useState<Image[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(0);
  const [loadTime, setLoadTime] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    groupId: "",
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

  // 加载分组列表
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await fetch("/api/admin/groups");
        if (response.ok) {
          const data = await response.json();
          setGroups(data.data?.groups || []);
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
          // 修复数据结构解析
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
      page: newFilters.page !== undefined ? newFilters.page : 1, // 重置页码除非明确指定
    }));
  };

  const handleUploadSuccess = (newImage: Image) => {
    // 重新加载图片列表
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm(t.adminImages.confirmDelete)) return;

    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // 重新加载图片列表
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
        // 重新加载图片列表
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
        // 重新加载图片列表
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
          "Content-Type": "application/json",
          "X-Admin-Password": "admin123",
        },
        body: JSON.stringify({
          imageIds,
          updates,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        success(t.adminGroups.updateSuccess, data.data.message);
        // 重新加载图片列表
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

  // --- V2 Layout ---
  if (version === "v2") {
    const paginationButtons = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
      const start = Math.max(1, Math.min(filters.page - 2, totalPages - 4));
      const page = start + i;
      if (page > totalPages) return null;
      return page;
    }).filter(Boolean) as number[];

    return (
      <div className="space-y-8 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ImageIcon className="w-8 h-8 text-primary" />
              {t.adminImages.title}
            </h1>
            <p className="text-muted-foreground mt-2">{t.adminImages.description}</p>
          </div>
          <GlassCard className="flex flex-wrap items-center gap-6 p-4" hover={false}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-500">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.adminImages.totalImages}</p>
                <p className="text-xl font-bold">{totalImages}</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20 text-green-500">
                <Grid className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.adminImages.groupCount}</p>
                <p className="text-xl font-bold">{groups.length}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Upload + Filters */}
        <div className="grid gap-6 lg:grid-cols-[2.5fr,1.5fr]">
          <GlassCard>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              {t.adminImages.uploadImage}
            </h2>
            <ImageUpload groups={groups} onUploadSuccess={handleUploadSuccess} />
          </GlassCard>

          <div className="space-y-6">
            <GlassCard>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                {t.adminImages.filterAndSearch}
              </h2>
              <ImageFilters filters={filters} groups={groups} onFilterChange={handleFilterChange} />
            </GlassCard>
            <GlassCard className="bg-gradient-to-br from-primary/20 to-purple-500/20 border-primary/20">
              <h3 className="font-semibold mb-2">Performance Tip</h3>
              <p className="text-sm text-muted-foreground">
                Use Cloudinary transformation parameters in your API calls for optimal image delivery speeds.
              </p>
            </GlassCard>
          </div>
        </div>

        {/* Image List */}
        <GlassCard className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                {t.adminImages.imageList}
              </h2>
              <span className="text-sm text-muted-foreground">
                ({totalImages} {t.adminImages.imagesCount})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t.adminImages.itemsPerPage}:</span>
              <select
                value={filters.limit}
                onChange={(e) => handleFilterChange({ limit: parseInt(e.target.value) })}
                className="bg-white/5 border border-white/10 rounded-lg text-sm px-3 py-1 outline-none focus:border-primary"
              >
                {[12, 24, 36, 48, 72, 100].map((count) => (
                  <option key={count} value={count} className="bg-gray-900">
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleFilterChange({ page: filters.page - 1 })}
                  disabled={filters.page <= 1}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.adminImages.previousPage}
                </button>
                <div className="flex gap-1 flex-wrap">
                  {paginationButtons.map((page) => (
                    <button
                      key={page}
                      onClick={() => handleFilterChange({ page })}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        page === filters.page
                          ? "bg-primary text-white shadow-lg shadow-primary/20"
                          : "bg-white/5 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleFilterChange({ page: filters.page + 1 })}
                  disabled={filters.page >= totalPages}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t.adminImages.nextPage}
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>{t.adminImages.currentPage}:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePageJump();
                  }}
                  className="w-20 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary outline-none"
                />
                <button
                  onClick={handlePageJump}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
                >
                  GO
                </button>
                <span>/ {totalPages}</span>
              </div>
            </div>
          )}
        </GlassCard>

        <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和统计 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">{t.adminImages.title}</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              {t.adminImages.description}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totalImages}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
              {t.adminImages.imagesCount}
            </div>
          </div>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {groups.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {t.adminImages.groupCount}
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {Math.ceil(totalImages / filters.limit)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {t.adminImages.totalPages}
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {filters.page}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {t.adminImages.currentPage}
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {images.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {t.adminImages.imagesOnPage}
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {loadTime > 0 ? `${loadTime}ms` : "-"}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {t.adminImages.loadTime}
            </div>
          </div>
        </div>
      </div>

      {/* 图片上传和筛选器 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 图片上传 */}
          <div>
            <h2 className="text-lg font-semibold panel-text mb-4">{t.adminImages.uploadImage}</h2>
            <ImageUpload
              groups={groups}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>

          {/* 筛选器 */}
          <div>
            <h2 className="text-lg font-semibold panel-text mb-4">
              {t.adminImages.filterAndSearch}
            </h2>
            <ImageFilters
              filters={filters}
              groups={groups}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>
      </div>

      {/* 图片列表 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold panel-text">
            {t.adminImages.imageList} ({totalImages} {t.adminImages.imagesCount})
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 panel-text">
            <span>{t.adminImages.itemsPerPage}:</span>
            <select
              value={filters.limit}
              onChange={(e) =>
                handleFilterChange({ limit: parseInt(e.target.value) })
              }
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
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

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-6">
            <button
              onClick={() => handleFilterChange({ page: filters.page - 1 })}
              disabled={filters.page <= 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 panel-text"
            >
              {t.adminImages.previousPage}
            </button>

            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + Math.max(1, filters.page - 2);
                if (page > totalPages) return null;

                return (
                  <button
                    key={page}
                    onClick={() => handleFilterChange({ page })}
                    className={`px-3 py-2 rounded-lg ${
                      page === filters.page
                        ? "bg-blue-500 text-white"
                        : "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 panel-text"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleFilterChange({ page: filters.page + 1 })}
              disabled={filters.page >= totalPages}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 panel-text"
            >
              {t.adminImages.nextPage}
            </button>
          </div>
        )}
      </div>

      {/* Toast通知容器 */}
      <ToastContainer
        toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))}
      />
    </div>
  );
}
