'use client'

import { useState, useEffect } from 'react'

interface Group {
  id: string
  name: string
  description?: string
  createdAt: string
  imageCount: number
}

interface FilterState {
  search: string
  groupId: string
  dateFrom: string
  dateTo: string
  page: number
  limit: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface ImageFiltersProps {
  filters: FilterState
  groups: Group[]
  onFilterChange: (filters: Partial<FilterState>) => void
}

export default function ImageFilters({ filters, groups, onFilterChange }: ImageFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search)

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFilterChange({ search: searchInput })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, filters.search, onFilterChange])

  // 同步外部搜索状态
  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  const handleReset = () => {
    setSearchInput('')
    onFilterChange({
      search: '',
      groupId: '',
      dateFrom: '',
      dateTo: '',
      page: 1
    })
  }

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  }

  const hasActiveFilters = filters.search || filters.groupId || filters.dateFrom || filters.dateTo

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div>
        <label className="block text-xs font-medium panel-text mb-1">
          搜索图片
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索文件名、标签..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            按分组筛选
          </label>
          <select
            value={filters.groupId}
            onChange={(e) => onFilterChange({ groupId: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="">所有分组</option>
            <option value="unassigned">未分组</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.imageCount})
              </option>
            ))}
          </select>
        </div>

        {/* 日期范围 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium panel-text mb-1">
              开始日期
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
              结束日期
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
            排序方式
          </label>
          <select
            value={`${filters.sortBy || 'uploadedAt'}-${filters.sortOrder || 'desc'}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-')
              onFilterChange({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' })
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="uploadedAt-desc">最新上传</option>
            <option value="uploadedAt-asc">最早上传</option>
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
          onClick={() => onFilterChange({
            dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          })}
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded panel-text transition-colors"
        >
          今天
        </button>
        <button
          onClick={() => onFilterChange({
            dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          })}
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded panel-text transition-colors"
        >
          最近7天
        </button>
        <button
          onClick={() => onFilterChange({
            dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          })}
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded panel-text transition-colors"
        >
          最近30天
        </button>
        {/* 重置按钮 */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ml-auto"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重置
          </button>
        )}
      </div>
    </div>
  )
}