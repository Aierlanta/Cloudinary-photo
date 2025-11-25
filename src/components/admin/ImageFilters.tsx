"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";
import { Search, Calendar, X, RotateCcw } from "lucide-react";
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
  const { t, locale } = useLocale();
  const isLight = useTheme();
  const [searchInput, setSearchInput] = useState(filters.search);

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

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
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

        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Group Filter */}
          <div className="space-y-1.5">
            <label className={cn(
              "text-xs font-medium ml-1",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.filterByGroup}
            </label>
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
              <option value="">{t.adminImages.selectGroupPlaceholder}</option>
              <option value="unassigned">{t.adminImages.unassigned}</option>
              {Array.isArray(groups) && groups.length > 0 ? (
                groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.imageCount || 0})
                  </option>
                ))
              ) : null}
            </select>
          </div>

          {/* Storage Filter */}
          <div className="space-y-1.5">
            <label className={cn(
              "text-xs font-medium ml-1",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.filterByStorage}
            </label>
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
              <option value="">{t.adminImages.allStorages}</option>
              <option value="cloudinary">Cloudinary</option>
              <option value="tgstate">tgState</option>
              <option value="telegram">Telegram</option>
              <option value="custom">{locale === 'zh' ? 'URL导入' : 'URL Import'}</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={cn(
                "text-xs font-medium ml-1",
                isLight ? "text-gray-700" : "text-gray-300"
              )}>
                {t.adminImages.startDate}
              </label>
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
            </div>
            <div className="space-y-1.5">
              <label className={cn(
                "text-xs font-medium ml-1",
                isLight ? "text-gray-700" : "text-gray-300"
              )}>
                {t.adminImages.endDate}
              </label>
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
            </div>
          </div>

          {/* Sort */}
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <label className={cn(
              "text-xs font-medium ml-1",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.sortBy}
            </label>
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
              <option value="filename-asc">Filename A-Z</option>
              <option value="filename-desc">Filename Z-A</option>
              <option value="bytes-desc">Size Large-Small</option>
              <option value="bytes-asc">Size Small-Large</option>
            </select>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { label: t.adminImages.today, days: 0 },
            { label: t.adminImages.last7Days, days: 6 },
            { label: t.adminImages.last30Days, days: 29 },
          ].map((item) => (
            <button
              key={item.days}
              onClick={() => {
                const now = new Date();
                // 计算用户本地时区的日期范围
                // dateFrom: N 天前的本地时间 00:00:00
                const fromDate = new Date(now);
                fromDate.setDate(fromDate.getDate() - item.days);
                fromDate.setHours(0, 0, 0, 0);
                // dateTo: 今天的本地时间 23:59:59.999
                const toDate = new Date(now);
                toDate.setHours(23, 59, 59, 999);
                // 传递 ISO 格式的 UTC 时间戳给后端
                onFilterChange({
                  dateFrom: fromDate.toISOString(),
                  dateTo: toDate.toISOString(),
                });
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium border transition-colors",
                isLight
                  ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                  : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
              )}
            >
              {item.label}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className={cn(
                "ml-auto px-3 py-1.5 text-xs border flex items-center gap-2 transition-colors",
                isLight
                  ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                  : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
              )}
            >
              <RotateCcw className="w-3 h-3" />
              {t.adminImages.reset}
            </button>
          )}
        </div>
      </div>
    );
}
