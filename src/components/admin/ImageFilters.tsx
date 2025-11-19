"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/hooks/useLocale";
import { useAdminVersion } from "@/contexts/AdminVersionContext";
import { Search, Calendar, X, RotateCcw, Filter } from "lucide-react";
import { GlassButton } from "@/components/ui/glass";
import { motion } from "framer-motion";

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
  const { version } = useAdminVersion();
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

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const hasActiveFilters =
    filters.search || filters.groupId || filters.dateFrom || filters.dateTo;

  // --- V2 Layout ---
  if (version === 'v2') {
    return (
      <div className="space-y-5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.adminImages.searchPlaceholder}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/10 rounded-full text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Group Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
               {t.adminImages.filterByGroup}
            </label>
            <select
              value={filters.groupId}
              onChange={(e) => onFilterChange({ groupId: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none transition-all text-sm"
            >
              <option value="" className="bg-gray-900">{t.adminImages.allGroups}</option>
              <option value="unassigned" className="bg-gray-900">Unassigned</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id} className="bg-gray-900">
                  {group.name} ({group.imageCount})
                </option>
              ))}
            </select>
          </div>

          {/* Storage Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">
               {t.adminImages.filterByStorage}
            </label>
            <select
              value={filters.provider}
              onChange={(e) => onFilterChange({ provider: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none transition-all text-sm"
            >
              <option value="" className="bg-gray-900">{t.adminImages.allStorages}</option>
              <option value="cloudinary" className="bg-gray-900">Cloudinary</option>
              <option value="tgstate" className="bg-gray-900">tgState</option>
              <option value="telegram" className="bg-gray-900">Telegram</option>
            </select>
          </div>
          
          {/* Date Range */}
          <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
               <label className="text-xs font-medium text-muted-foreground ml-1">
                  {t.adminImages.startDate}
               </label>
               <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={formatDateForInput(filters.dateFrom)}
                    onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
                    className="w-full pl-9 p-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm dark-calendar-icon"
                  />
               </div>
            </div>
            <div className="space-y-1.5">
               <label className="text-xs font-medium text-muted-foreground ml-1">
                  {t.adminImages.endDate}
               </label>
               <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={formatDateForInput(filters.dateTo)}
                    onChange={(e) => onFilterChange({ dateTo: e.target.value })}
                    className="w-full pl-9 p-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm dark-calendar-icon"
                  />
               </div>
            </div>
          </div>

          {/* Sort */}
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground ml-1">
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
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none transition-all text-sm"
              >
                <option value="uploadedAt-desc" className="bg-gray-900">{t.adminImages.latestUpload}</option>
                <option value="uploadedAt-asc" className="bg-gray-900">{t.adminImages.oldestUpload}</option>
                <option value="filename-asc" className="bg-gray-900">Filename A-Z</option>
                <option value="filename-desc" className="bg-gray-900">Filename Z-A</option>
                <option value="bytes-desc" className="bg-gray-900">Size Large-Small</option>
                <option value="bytes-asc" className="bg-gray-900">Size Small-Large</option>
              </select>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
           {[
              { label: t.adminImages.today, days: 1 },
              { label: t.adminImages.last7Days, days: 7 },
              { label: t.adminImages.last30Days, days: 30 },
           ].map((item) => (
              <button
                key={item.days}
                onClick={() =>
                  onFilterChange({
                    dateFrom: new Date(Date.now() - (item.days === 1 ? 1 : item.days) * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split("T")[0],
                    dateTo: new Date().toISOString().split("T")[0],
                  })
                }
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </button>
           ))}
           
           {hasActiveFilters && (
             <GlassButton 
                onClick={handleReset}
                className="ml-auto px-3 py-1.5 text-xs h-auto"
                icon={RotateCcw}
             >
                Reset
             </GlassButton>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div>
        <label className="block text-xs font-medium panel-text mb-1">
          {t.adminImages.imageList}
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.adminImages.searchPlaceholder}
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg
                className="h-4 w-4"
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
          )}
        </div>
        {searchInput && searchInput !== filters.search && (
          <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
            正在搜索...
          </div>
        )}
      </div>

      {/* 筛选和排序选项 */}
      <div className="space-y-3">
        {/* 分组筛选 */}
        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            {t.adminImages.filterByGroup}
          </label>
          <select
            value={filters.groupId}
            onChange={(e) => onFilterChange({ groupId: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="">{t.adminImages.allGroups}</option>
            <option value="unassigned">未分组</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.imageCount})
              </option>
            ))}
          </select>
        </div>

        {/* 图床筛选 */}
        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            {t.adminImages.filterByStorage}
          </label>
          <select
            value={filters.provider}
            onChange={(e) => onFilterChange({ provider: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="">{t.adminImages.allStorages}</option>
            <option value="cloudinary">Cloudinary</option>
            <option value="tgstate">tgState (第三方)</option>
            <option value="telegram">Telegram 直连</option>
          </select>
        </div>

        {/* 日期范围 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium panel-text mb-1">
              {t.adminImages.startDate}
            </label>
            <input
              type="date"
              value={formatDateForInput(filters.dateFrom)}
              onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
            />
          </div>
          <div>
            <label className="block text-xs font-medium panel-text mb-1">
              {t.adminImages.endDate}
            </label>
            <input
              type="date"
              value={formatDateForInput(filters.dateTo)}
              onChange={(e) => onFilterChange({ dateTo: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
            />
          </div>
        </div>

        {/* 排序方式 */}
        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            {t.adminImages.sortBy}
          </label>
          <select
            value={`${filters.sortBy || "uploadedAt"}-${
              filters.sortOrder || "desc"
            }`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split("-");
              onFilterChange({
                sortBy,
                sortOrder: sortOrder as "asc" | "desc",
              });
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="uploadedAt-desc">
              {t.adminImages.latestUpload}
            </option>
            <option value="uploadedAt-asc">{t.adminImages.oldestUpload}</option>
            <option value="filename-asc">文件名 A-Z</option>
            <option value="filename-desc">文件名 Z-A</option>
            <option value="bytes-desc">文件大小 大-小</option>
            <option value="bytes-asc">文件大小 小-大</option>
          </select>
        </div>
      </div>

      {/* 快速筛选按钮 */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() =>
            onFilterChange({
              dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              dateTo: new Date().toISOString().split("T")[0],
            })
          }
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded panel-text transition-colors"
        >
          {t.adminImages.today}
        </button>
        <button
          onClick={() =>
            onFilterChange({
              dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              dateTo: new Date().toISOString().split("T")[0],
            })
          }
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded panel-text transition-colors"
        >
          {t.adminImages.last7Days}
        </button>
        <button
          onClick={() =>
            onFilterChange({
              dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              dateTo: new Date().toISOString().split("T")[0],
            })
          }
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded panel-text transition-colors"
        >
          {t.adminImages.last30Days}
        </button>
        {/* 重置按钮 */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ml-auto"
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            重置
          </button>
        )}
      </div>
    </div>
  );
}
