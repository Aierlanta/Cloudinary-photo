"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";
import { Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

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
  provider: string; // 新增：图床筛选
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface ImageFiltersProps {
  filters: FilterState;
  groups: Group[];
  onFilterChange: (filters: Partial<FilterState>) => void;
}

export default function ImageFilters({
  filters,
  groups,
  onFilterChange,
}: ImageFiltersProps) {
  const { t } = useLocale();
  const isLight = useTheme();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  // 同步外部搜索状态
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const handleReset = () => {
    setSearchInput("");
    onFilterChange({
      search: "",
      groupId: "",
      provider: "", // 新增：重置图床筛选
      dateFrom: "",
      dateTo: "",
      page: 1,
    });
  };

  // 将 ISO 时间戳转换为本地日期字符串（用于 date input 显示）
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // 使用本地时区的日期格式
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 将本地日期字符串转换为 UTC 时间戳
  const localDateToUTC = (dateString: string, isEndOfDay: boolean) => {
    if (!dateString) return "";
    // 解析为本地时间
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (isEndOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date.toISOString();
  };

  const hasActiveFilters =
    filters.search || filters.groupId || filters.dateFrom || filters.dateTo;

  return (
      <div className="admin-gallery-filters">
        <div className="admin-gallery-search relative">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
            isLight ? "text-gray-400" : "text-gray-500"
          )} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.adminImages.searchPlaceholder}
            className={cn(
              "w-full pl-9 pr-9 py-2 border outline-none focus:border-blue-500 text-sm",
              isLight
                ? "bg-white border-gray-300"
                : "bg-gray-800 border-gray-600"
            )}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-colors",
                isLight
                  ? "text-gray-400 hover:bg-gray-100"
                  : "text-gray-500 hover:bg-gray-700"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="admin-gallery-primary-filters">
          <label>
            <span>{t.adminImages.filterByGroup}</span>
            <select
              value={filters.groupId}
              onChange={(e) => onFilterChange({ groupId: e.target.value })}
              className={cn(
                "w-full p-2 border outline-none focus:border-blue-500 text-sm",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            >
              <option value="">{t.adminUi.groupAll}</option>
              <option value="unassigned">{t.adminImages.unassigned}</option>
              {Array.isArray(groups) && groups.length > 0 ? (
                groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.imageCount || 0})
                  </option>
                ))
                ) : null}
            </select>
          </label>

          <label>
            <span>{t.adminImages.filterByStorage}</span>
            <select
              value={filters.provider}
              onChange={(e) => onFilterChange({ provider: e.target.value })}
              className={cn(
                "w-full p-2 border outline-none focus:border-blue-500 text-sm",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            >
              <option value="">{t.adminUi.storageAll}</option>
              <option value="cloudinary">Cloudinary</option>
              <option value="tgstate">tgState</option>
              <option value="telegram">Telegram</option>
              <option value="custom">{t.adminUi.urlImport}</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className={cn("admin-gallery-advanced-toggle", showAdvanced && "is-active")}
            aria-expanded={showAdvanced}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t.adminUi.moreFilters}
          </button>

          {hasActiveFilters ? (
            <button type="button" onClick={handleReset} className="admin-gallery-reset">
              <RotateCcw className="w-4 h-4" />
              {t.adminImages.reset}
            </button>
          ) : null}
        </div>

        {showAdvanced ? (
          <div className="admin-gallery-advanced">
            <label>
              <span>{t.adminImages.startDate}</span>
              <input
                type="date"
                value={formatDateForInput(filters.dateFrom)}
                onChange={(e) => onFilterChange({ dateFrom: localDateToUTC(e.target.value, false) })}
                className={cn(
                  "w-full p-2 border outline-none focus:border-blue-500 text-sm",
                  isLight
                    ? "bg-white border-gray-300"
                    : "bg-gray-800 border-gray-600"
                )}
              />
            </label>
            <label>
              <span>{t.adminImages.endDate}</span>
              <input
                type="date"
                value={formatDateForInput(filters.dateTo)}
                onChange={(e) => onFilterChange({ dateTo: localDateToUTC(e.target.value, true) })}
                className={cn(
                  "w-full p-2 border outline-none focus:border-blue-500 text-sm",
                  isLight
                    ? "bg-white border-gray-300"
                    : "bg-gray-800 border-gray-600"
                )}
              />
            </label>
            <label>
              <span>{t.adminImages.sortBy}</span>
            <select
              value={`${filters.sortBy || "uploadedAt"}-${filters.sortOrder || "desc"}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-");
                onFilterChange({
                  sortBy,
                  sortOrder: sortOrder as "asc" | "desc",
                });
              }}
              className={cn(
                "w-full p-2 border outline-none focus:border-blue-500 text-sm",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            >
              <option value="uploadedAt-desc">{t.adminImages.latestUpload}</option>
              <option value="uploadedAt-asc">{t.adminImages.oldestUpload}</option>
              <option value="filename-asc">{t.adminUi.filenameAsc}</option>
              <option value="filename-desc">{t.adminUi.filenameDesc}</option>
              <option value="bytes-desc">{t.adminUi.sizeLargeToSmall}</option>
              <option value="bytes-asc">{t.adminUi.sizeSmallToLarge}</option>
            </select>
            </label>

            <div className="admin-gallery-quick-filters">
              {[
                { label: t.adminImages.today, days: 0 },
                { label: t.adminImages.last7Days, days: 6 },
                { label: t.adminImages.last30Days, days: 29 },
              ].map((item) => (
                <button
                  key={item.days}
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const fromDate = new Date(now);
                    fromDate.setDate(fromDate.getDate() - item.days);
                    fromDate.setHours(0, 0, 0, 0);
                    const toDate = new Date(now);
                    toDate.setHours(23, 59, 59, 999);
                    onFilterChange({
                      dateFrom: fromDate.toISOString(),
                      dateTo: toDate.toISOString(),
                    });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
}
