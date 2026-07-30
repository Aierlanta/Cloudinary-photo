"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ImageList from "@/components/admin/ImageList";
import ImageFilters from "@/components/admin/ImageFilters";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { getNodeDisplayName, useAdminApi } from "@/lib/admin-api-client";
import pageStyles from "../admin-pages.module.css";

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

interface FilterState {
  search: string;
  groupId: string;
  ownerNodeId: string;
  provider: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

const ITEMS_PER_PAGE_BASE = 15;
const ITEMS_PER_PAGE_COUNT = 6;

const itemsPerPageOptions = Array.from(
  { length: ITEMS_PER_PAGE_COUNT },
  (_, index) => ITEMS_PER_PAGE_BASE * (index + 1)
);

export default function GalleryPage() {
  const { t } = useLocale();
  const isLight = useTheme();
  const { adminFetch, selectedNodeId, nodes } = useAdminApi();
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
    ownerNodeId: "",
    provider: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: ITEMS_PER_PAGE_BASE,
    sortBy: "uploadedAt",
    sortOrder: "desc",
  });

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
        const response = await adminFetch("/api/admin/groups");
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
  }, [adminFetch, selectedNodeId]);

  // 加载图片列表
  useEffect(() => {
    const loadImages = async () => {
      const startTime = performance.now();
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.search) params.append("search", filters.search);
        if (filters.groupId) params.append("groupId", filters.groupId);
        if (filters.ownerNodeId) params.append("ownerNodeId", filters.ownerNodeId);
        if (filters.provider) params.append("provider", filters.provider);
        if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.append("dateTo", filters.dateTo);
        params.append("page", filters.page.toString());
        params.append("limit", filters.limit.toString());
        params.append("sortBy", filters.sortBy);
        params.append("sortOrder", filters.sortOrder);

        const response = await adminFetch(`/api/admin/images?${params}`);
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
  }, [adminFetch, selectedNodeId, filters]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const response = await adminFetch(`/api/admin/images/${imageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(t.adminGroups.deleteFailed);
      }

      setFilters((prev) => ({ ...prev }));
    } catch (error) {
      console.error("删除图片失败:", error);
      throw error;
    }
  };

  const handleBulkDelete = async (imageIds: string[]) => {
    try {
      const response = await adminFetch("/api/admin/images", {
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
        showError(t.adminGroups.deleteFailed, t.adminImages.bulkDeleteFailed);
      }
    } catch (error) {
      console.error("批量删除图片失败:", error);
      showError(t.adminGroups.deleteFailed, t.adminImages.bulkDeleteFailed);
    }
  };

  const handleUpdateImage = async (
    imageId: string,
    updates: { groupId?: string; tags?: string[] }
  ) => {
    try {
      const response = await adminFetch(`/api/admin/images/${imageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setFilters((prev) => ({ ...prev }));
      } else {
        showError(t.adminImages.updateFailed);
      }
    } catch (error) {
      console.error("更新图片失败:", error);
      showError(t.adminImages.updateFailed);
    }
  };

  const handleBulkUpdate = async (
    imageIds: string[],
    updates: { groupId?: string; tags?: string[] }
  ) => {
    try {
      const response = await adminFetch("/api/admin/images", {
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
        showError(t.adminGroups.updateFailed, t.adminImages.bulkUpdateFailed);
      }
    } catch (error) {
      console.error("批量更新图片失败:", error);
      showError(t.adminGroups.updateFailed, t.adminImages.bulkUpdateFailed);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalImages / filters.limit));
  const paginationButtons = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    const start = Math.max(1, Math.min(filters.page - 2, totalPages - 4));
    const page = start + i;
    if (page > totalPages) return null;
    return page;
  }).filter(Boolean) as number[];
  const lastPaginationButton = paginationButtons[paginationButtons.length - 1];

  const handleExport = () => {
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["id", "title", "url", "groupId", "provider", "uploadedAt"];
    const rows = images.map((image) => [
      image.id,
      image.title || image.publicId,
      image.url,
      image.groupId || "",
      image.primaryProvider || "",
      image.uploadedAt,
    ]);
    const csv = [header, ...rows].map((row) => row.map(quote).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gallery-page-${filters.page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${pageStyles.page} admin-gallery-page`}>
      <div className="admin-gallery-toolbar">
        <ImageFilters filters={filters} groups={groups} onFilterChange={handleFilterChange} />
        <div className="admin-gallery-toolbar-actions">
          <Link href="/admin/images"><Plus aria-hidden /> {t.adminNav.upload}</Link>
          <button type="button" onClick={() => setFilters((current) => ({ ...current }))}>
            <RefreshCw aria-hidden /> {t.common.refresh}
          </button>
          <button type="button" onClick={handleExport}>
            <Download aria-hidden /> {t.adminUi.exportData}
          </button>
        </div>
      </div>

      <div className="admin-gallery-owner-filter">
          <label className={cn(
            "block text-xs font-medium mb-2",
            isLight ? "text-gray-700" : "text-gray-300"
          )}>
            {t.adminUi.galleryOwnerNode}
          </label>
          <select
            value={filters.ownerNodeId}
            onChange={(event) => handleFilterChange({ ownerNodeId: event.target.value })}
            className={cn(
              "w-full md:w-80 px-3 py-2 border text-sm outline-none focus:border-blue-500 rounded-lg",
              pageStyles.input
            )}
          >
            <option value="">{t.adminUi.allNodes}</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {getNodeDisplayName(node, t.adminUi.currentNode)}
              </option>
            ))}
            <option value="unknown">{t.adminUi.unknownOwner}</option>
          </select>
          <p className={cn("mt-2 text-xs", isLight ? "text-gray-500" : "text-gray-400")}>
            {t.adminUi.galleryOwnerHint}
          </p>
      </div>

      <div className="admin-gallery-content">
        <div className="admin-gallery-page-size">
          <span>{t.adminUi.perPage}</span>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange({ limit: parseInt(e.target.value) })}
              className={cn(
                "border text-sm px-3 py-1 outline-none focus:border-blue-500 rounded-lg",
                pageStyles.input
              )}
            >
              {itemsPerPageOptions.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
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

        {images.length > 0 && (
          <nav className="admin-gallery-pagination" aria-label={t.adminUi.galleryPagination}>
            <button
              type="button"
              className="admin-gallery-page-arrow"
              onClick={() => handleFilterChange({ page: filters.page - 1 })}
              disabled={filters.page <= 1}
              aria-label={t.adminImages.previousPage}
              title={t.adminImages.previousPage}
            >
              <ChevronLeft aria-hidden />
            </button>
            {paginationButtons.map((page, index) => (
              <span key={page} className="admin-gallery-page-entry">
                {index === 0 && page > 1 ? (
                  <span className="admin-gallery-page-ellipsis" aria-hidden><MoreHorizontal /></span>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleFilterChange({ page })}
                  className={cn(
                    "admin-gallery-page-button",
                    page === filters.page && "is-active"
                  )}
                  aria-current={page === filters.page ? "page" : undefined}
                  aria-label={`${t.adminImages.currentPage} ${page}`}
                >
                  {page}
                </button>
              </span>
            ))}
            {lastPaginationButton && lastPaginationButton < totalPages ? (
              <>
                <span className="admin-gallery-page-ellipsis" aria-hidden><MoreHorizontal /></span>
                <button
                  type="button"
                  onClick={() => handleFilterChange({ page: totalPages })}
                  className="admin-gallery-page-button"
                  aria-label={`${t.adminImages.currentPage} ${totalPages}`}
                >
                  {totalPages}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="admin-gallery-page-arrow"
              onClick={() => handleFilterChange({ page: filters.page + 1 })}
              disabled={filters.page >= totalPages}
              aria-label={t.adminImages.nextPage}
              title={t.adminImages.nextPage}
            >
              <ChevronRight aria-hidden />
            </button>
          </nav>
        )}
      </div>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}
