'use client'

import { useState, useEffect } from 'react'

interface Group {
  id: string
  name: string
  description: string
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
        <label className="block text-sm font-medium panel-text mb-2">
          搜索图片
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索文件名、标签... (实时搜索)"
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 分组筛选 */}
        <div>
          <label className="block text-sm font-medium panel-text mb-2">
            按分组筛选
          </label>
          <select
            value={filters.groupId}
            onChange={(e) => onFilterChange({ groupId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
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

        {/* 开始日期 */}
        <div>
          <label className="block text-sm font-medium panel-text mb-2">
            上传日期从
          </label>
          <input
            type="date"
            value={formatDateForInput(filters.dateFrom)}
            onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
        </div>

        {/* 结束日期 */}
        <div>
          <label className="block text-sm font-medium panel-text mb-2">
            上传日期到
          </label>
          <input
            type="date"
            value={formatDateForInput(filters.dateTo)}
            onChange={(e) => onFilterChange({ dateTo: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
        </div>

        {/* 排序方式 */}
        <div>
          <label className="block text-sm font-medium panel-text mb-2">
            排序方式
          </label>
          <div className="flex space-x-2">
            <select
              value={`${filters.sortBy || 'uploadedAt'}-${filters.sortOrder || 'desc'}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-')
                onFilterChange({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' })
              }}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
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
      </div>

      {/* 快速筛选按钮 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onFilterChange({ 
            dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          })}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full panel-text transition-colors"
        >
          今天
        </button>
        <button
          onClick={() => onFilterChange({ 
            dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          })}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full panel-text transition-colors"
        >
          最近7天
        </button>
        <button
          onClick={() => onFilterChange({ 
            dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dateTo: new Date().toISOString().split('T')[0]
          })}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full panel-text transition-colors"
        >
          最近30天
        </button>
      </div>

      {/* 重置按钮 */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重置筛选
          </button>
        </div>
      )}
    </div>
  )
}