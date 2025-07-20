'use client'

import { useState, useEffect } from 'react'
import ImageUpload from '@/components/admin/ImageUpload'
import ImageList from '@/components/admin/ImageList'
import ImageFilters from '@/components/admin/ImageFilters'

interface Image {
  id: string
  publicId: string
  url: string
  title?: string
  description?: string
  groupId?: string
  uploadedAt: string
  tags?: string[]
}

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

export default function ImagesPage() {
  const [images, setImages] = useState<Image[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [totalImages, setTotalImages] = useState(0)
  const [loadTime, setLoadTime] = useState(0)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    groupId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 12,
    sortBy: 'uploadedAt',
    sortOrder: 'desc'
  })

  // 加载分组列表
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await fetch('/api/admin/groups')
        if (response.ok) {
          const data = await response.json()
          setGroups(data.data?.groups || [])
        }
      } catch (error) {
        console.error('加载分组失败:', error)
      }
    }
    loadGroups()
  }, [])

  // 加载图片列表
  useEffect(() => {
    const loadImages = async () => {
      const startTime = performance.now()
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filters.search) params.append('search', filters.search)
        if (filters.groupId) params.append('groupId', filters.groupId)
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.append('dateTo', filters.dateTo)
        params.append('page', filters.page.toString())
        params.append('limit', filters.limit.toString())
        params.append('sortBy', filters.sortBy)
        params.append('sortOrder', filters.sortOrder)

        const response = await fetch(`/api/admin/images?${params}`)
        if (response.ok) {
          const data = await response.json()
          // 修复数据结构解析
          const imagesData = data.data?.images
          setImages(imagesData?.data || [])
          setTotalImages(imagesData?.total || 0)
        } else {
          console.error('加载图片失败:', response.statusText)
        }
      } catch (error) {
        console.error('加载图片失败:', error)
      } finally {
        const endTime = performance.now()
        setLoadTime(Math.round(endTime - startTime))
        setLoading(false)
      }
    }

    loadImages()
  }, [filters])

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1 // 重置页码除非明确指定
    }))
  }

  const handleUploadSuccess = (newImage: Image) => {
    // 重新加载图片列表
    setFilters(prev => ({ ...prev, page: 1 }))
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('确定要删除这张图片吗？')) return

    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // 重新加载图片列表
        setFilters(prev => ({ ...prev }))
      } else {
        alert('删除图片失败')
      }
    } catch (error) {
      console.error('删除图片失败:', error)
      alert('删除图片失败')
    }
  }

  const handleBulkDelete = async (imageIds: string[]) => {
    try {
      const response = await fetch('/api/admin/images', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageIds })
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.data.message)
        // 重新加载图片列表
        setFilters(prev => ({ ...prev }))
      } else {
        alert('批量删除图片失败')
      }
    } catch (error) {
      console.error('批量删除图片失败:', error)
      alert('批量删除图片失败')
    }
  }

  const handleUpdateImage = async (imageId: string, updates: { groupId?: string; tags?: string[] }) => {
    try {
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        // 重新加载图片列表
        setFilters(prev => ({ ...prev }))
      } else {
        alert('更新图片失败')
      }
    } catch (error) {
      console.error('更新图片失败:', error)
      alert('更新图片失败')
    }
  }

  const totalPages = Math.ceil(totalImages / filters.limit)

  return (
    <div className="space-y-6">
      {/* 页面标题和统计 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">图片管理</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              上传、管理和组织您的图片库
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totalImages}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
              张图片
            </div>
          </div>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">{groups.length}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">分组数量</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {Math.ceil(totalImages / filters.limit)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">总页数</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">{filters.page}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">当前页</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">{images.length}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">本页图片</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {loadTime > 0 ? `${loadTime}ms` : '-'}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">加载时间</div>
          </div>
        </div>
      </div>

      {/* 图片上传 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-lg font-semibold panel-text mb-4">上传图片</h2>
        <ImageUpload 
          groups={groups} 
          onUploadSuccess={handleUploadSuccess}
        />
      </div>

      {/* 筛选器 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-lg font-semibold panel-text mb-4">筛选和搜索</h2>
        <ImageFilters
          filters={filters}
          groups={groups}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* 图片列表 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold panel-text">
            图片列表 ({totalImages} 张)
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 panel-text">
            <span>每页显示:</span>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange({ limit: parseInt(e.target.value) })}
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
        />

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-6">
            <button
              onClick={() => handleFilterChange({ page: filters.page - 1 })}
              disabled={filters.page <= 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 panel-text"
            >
              上一页
            </button>
            
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + Math.max(1, filters.page - 2)
                if (page > totalPages) return null
                
                return (
                  <button
                    key={page}
                    onClick={() => handleFilterChange({ page })}
                    className={`px-3 py-2 rounded-lg ${
                      page === filters.page
                        ? 'bg-blue-500 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 panel-text'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handleFilterChange({ page: filters.page + 1 })}
              disabled={filters.page >= totalPages}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 panel-text"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  )
}