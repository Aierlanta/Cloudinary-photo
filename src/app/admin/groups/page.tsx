'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import Image from 'next/image'
import { generateThumbnailUrl } from '@/lib/image-utils'

interface Group {
  id: string
  name: string
  description: string
  createdAt: string
  imageCount: number
}

interface GroupFormData {
  name: string
  description: string
}

interface Image {
  id: string
  cloudinaryId: string
  publicId: string
  url: string
  secureUrl: string
  filename: string
  format: string
  width: number
  height: number
  bytes: number
  groupId?: string
  uploadedAt: string
  tags: string[]
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState<GroupFormData>({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null)
  const [groupImages, setGroupImages] = useState<Image[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [showUnassignedImages, setShowUnassignedImages] = useState(false)
  const [unassignedImages, setUnassignedImages] = useState<Image[]>([])
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())

  // Toast通知
  const { toasts, success, error: showError, removeToast } = useToast()
  const [assigningToGroup, setAssigningToGroup] = useState('')
  const [totalImages, setTotalImages] = useState(0)

  // 加载分组列表和总图片数
  useEffect(() => {
    loadGroups()
    loadTotalImages()
  }, [])

  const loadGroups = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/groups', {
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setGroups(data.data?.groups || [])
      } else {
        console.error('加载分组失败:', response.statusText)
      }
    } catch (error) {
      console.error('加载分组失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTotalImages = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setTotalImages(data.data?.totalImages || 0)
      } else {
        console.error('加载总图片数失败:', response.statusText)
      }
    } catch (error) {
      console.error('加载总图片数失败:', error)
    }
  }

  const loadGroupImages = async (groupId: string) => {
    setLoadingImages(true)
    try {
      const response = await fetch(`/api/admin/images?groupId=${groupId}&limit=12&sortBy=uploadedAt&sortOrder=desc`, {
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setGroupImages(data.data?.images?.data || [])
      } else {
        console.error('加载分组图片失败:', response.statusText)
      }
    } catch (error) {
      console.error('加载分组图片失败:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  const loadUnassignedImages = async () => {
    setLoadingImages(true)
    try {
      const response = await fetch('/api/admin/images?groupId=unassigned&limit=100', {
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUnassignedImages(data.data?.images?.data || [])
      } else {
        console.error('加载未分组图片失败:', response.statusText)
      }
    } catch (error) {
      console.error('加载未分组图片失败:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!formData.name.trim()) {
      showError('验证失败', '请输入分组名称')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin123'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadGroups()
        await loadTotalImages()
        setFormData({ name: '', description: '' })
        setShowCreateForm(false)
        success('创建成功', '分组创建成功')
      } else {
        showError('创建失败', '创建分组失败')
      }
    } catch (error) {
      console.error('创建分组失败:', error)
      showError('创建失败', '创建分组失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateGroup = async () => {
    if (!editingGroup || !formData.name.trim()) {
      alert('请输入分组名称')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin123'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadGroups()
        await loadTotalImages()
        setEditingGroup(null)
        setFormData({ name: '', description: '' })
        alert('分组更新成功')
      } else {
        alert('更新分组失败')
      }
    } catch (error) {
      console.error('更新分组失败:', error)
      alert('更新分组失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`确定要删除分组"${groupName}"吗？此操作将会影响该分组下的所有图片。`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })

      if (response.ok) {
        const data = await response.json()
        success('删除成功', data.data.message)
        await loadGroups()
        await loadTotalImages()
      } else {
        showError('删除失败', '删除分组失败')
      }
    } catch (error) {
      console.error('删除分组失败:', error)
      showError('删除失败', '删除分组失败')
    }
  }

  const startEdit = (group: Group) => {
    setEditingGroup(group)
    setFormData({ name: group.name, description: group.description })
    setShowCreateForm(false)
  }

  const cancelEdit = () => {
    setEditingGroup(null)
    setFormData({ name: '', description: '' })
  }

  const startCreate = () => {
    setShowCreateForm(true)
    setEditingGroup(null)
    setFormData({ name: '', description: '' })
  }

  const viewGroupImages = async (group: Group) => {
    setViewingGroup(group)
    await loadGroupImages(group.id)
  }

  const closeImageView = () => {
    setViewingGroup(null)
    setGroupImages([])
  }

  const showUnassignedImagesModal = async () => {
    setShowUnassignedImages(true)
    await loadUnassignedImages()
  }

  const closeUnassignedImagesModal = () => {
    setShowUnassignedImages(false)
    setUnassignedImages([])
    setSelectedImages(new Set())
    setAssigningToGroup('')
  }

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId)
    } else {
      newSelected.add(imageId)
    }
    setSelectedImages(newSelected)
  }

  const selectAllImages = () => {
    setSelectedImages(new Set(unassignedImages.map(img => img.id)))
  }

  const clearSelection = () => {
    setSelectedImages(new Set())
  }

  const assignImagesToGroup = async () => {
    if (selectedImages.size === 0 || !assigningToGroup) {
      alert('请选择图片和目标分组')
      return
    }

    try {
      const updatePromises = Array.from(selectedImages).map(imageId =>
        fetch(`/api/admin/images/${imageId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': 'admin123'
          },
          body: JSON.stringify({ groupId: assigningToGroup })
        })
      )

      await Promise.all(updatePromises)

      alert(`成功将 ${selectedImages.size} 张图片分配到分组`)
      await loadUnassignedImages()
      await loadGroups()
      await loadTotalImages()
      clearSelection()
      setAssigningToGroup('')
    } catch (error) {
      console.error('分配图片失败:', error)
      alert('分配图片失败')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和统计 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">分组管理</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              创建和管理图片分组，组织您的图片库
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {groups.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
              个分组
            </div>
          </div>
        </div>

        {/* 快速统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {totalImages}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">总图片数</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {groups.filter(g => g.imageCount > 0).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">有图片的分组</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {groups.filter(g => g.imageCount === 0).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">空分组</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold panel-text">
              {groups.length > 0 ? Math.round(groups.reduce((sum, group) => sum + group.imageCount, 0) / groups.length) : 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">平均图片数</div>
          </div>
        </div>
      </div>

      {/* 创建/编辑分组表单 */}
      {(showCreateForm || editingGroup) && (
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h2 className="text-lg font-semibold panel-text mb-4">
            {editingGroup ? '编辑分组' : '创建新分组'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                分组名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入分组名称"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                分组描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入分组描述（可选）"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text resize-none"
                maxLength={200}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                disabled={submitting || !formData.name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {submitting ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {editingGroup ? '更新中...' : '创建中...'}
                  </div>
                ) : (
                  editingGroup ? '更新分组' : '创建分组'
                )}
              </button>
              <button
                onClick={editingGroup ? cancelEdit : () => setShowCreateForm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分组列表 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold panel-text">分组列表</h2>
          {!showCreateForm && !editingGroup && (
            <div className="flex space-x-3">
              <button
                onClick={showUnassignedImagesModal}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                管理未分组图片
              </button>
              <button
                onClick={startCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                创建分组
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="animate-pulse">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium panel-text mb-2">暂无分组</h3>
            <p className="text-gray-500 dark:text-gray-400 panel-text mb-4">
              还没有创建任何分组，点击上方的"创建分组"按钮开始吧！
            </p>
            <button
              onClick={startCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              创建第一个分组
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-medium panel-text mr-3">{group.name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        group.imageCount > 0
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {group.imageCount} 张图片
                      </span>
                    </div>

                    {group.description && (
                      <p className="text-gray-600 dark:text-gray-300 panel-text mb-2">
                        {group.description}
                      </p>
                    )}

                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      创建于 {formatDate(group.createdAt)}
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    {group.imageCount > 0 && (
                      <button
                        onClick={() => viewGroupImages(group)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
                        title="查看图片"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(group)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                      title="编辑分组"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                      title="删除分组"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 查看分组图片模态框 */}
      {viewingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="transparent-panel rounded-lg max-w-6xl max-h-[90vh] overflow-hidden w-full">
            <div className="p-6">
              {/* 头部 */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold panel-text">
                    分组图片 - {viewingGroup.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 panel-text">
                    共 {viewingGroup.imageCount} 张图片
                  </p>
                </div>
                <button
                  onClick={closeImageView}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 图片网格 */}
              <div className="max-h-[70vh] overflow-y-auto">
                {loadingImages ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <div key={index} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : groupImages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 panel-text">
                      该分组暂无图片
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {groupImages.map((image) => (
                      <div
                        key={image.id}
                        className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <img
                          src={generateThumbnailUrl(image.url, 300)}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 如果缩略图加载失败，尝试使用原图
                            const target = e.target as HTMLImageElement;
                            if (target.src !== image.secureUrl) {
                              target.src = image.secureUrl;
                            }
                          }}
                        />

                        {/* 悬停信息 */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-200 flex items-end opacity-0 group-hover:opacity-100">
                          <div className="p-2 text-white text-xs w-full">
                            <p className="truncate font-medium">{image.filename}</p>
                            <p className="text-gray-300">
                              {image.width} × {image.height}
                            </p>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => window.open(image.secureUrl, '_blank')}
                            className="bg-white text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            title="查看原图"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 底部操作 */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
                  显示 {groupImages.length} 张图片{viewingGroup && viewingGroup.imageCount > 12 ? ` (最新 ${Math.min(groupImages.length, 12)} 张)` : ''}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      closeImageView()
                      // 可以跳转到图片管理页面并筛选该分组
                      window.location.href = `/admin/images?groupId=${viewingGroup.id}`
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    在图片管理中查看
                  </button>
                  <button
                    onClick={closeImageView}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 未分组图片管理模态框 */}
      {showUnassignedImages && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="transparent-panel rounded-lg max-w-6xl max-h-[90vh] overflow-hidden w-full">
            <div className="p-6">
              {/* 头部 */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold panel-text">
                    未分组图片管理
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 panel-text">
                    选择图片并分配到分组中
                  </p>
                </div>
                <button
                  onClick={closeUnassignedImagesModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 操作工具栏 */}
              {unassignedImages.length > 0 && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400 panel-text">
                        已选择 {selectedImages.size} 张图片
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={selectAllImages}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          全选
                        </button>
                        <button
                          onClick={clearSelection}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                        >
                          清除选择
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedImages.size > 0 && (
                    <div className="flex items-center space-x-3">
                      <label className="text-sm font-medium panel-text">
                        分配到分组:
                      </label>
                      <select
                        value={assigningToGroup}
                        onChange={(e) => setAssigningToGroup(e.target.value)}
                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 panel-text"
                      >
                        <option value="">选择分组...</option>
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={assignImagesToGroup}
                        disabled={!assigningToGroup}
                        className="px-4 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm rounded transition-colors"
                      >
                        分配图片
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 图片网格 */}
              <div className="max-h-[60vh] overflow-y-auto">
                {loadingImages ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <div key={index} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : unassignedImages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium panel-text mb-2">所有图片都已分组</h4>
                    <p className="text-gray-500 dark:text-gray-400 panel-text">
                      没有未分组的图片需要处理
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {unassignedImages.map((image) => (
                      <div
                        key={image.id}
                        className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                          selectedImages.has(image.id)
                            ? 'ring-2 ring-blue-500 ring-offset-2'
                            : 'hover:shadow-lg'
                        }`}
                        onClick={() => toggleImageSelection(image.id)}
                      >
                        <Image
                          src={generateThumbnailUrl(image.url, 300)}
                          alt={image.publicId}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                        />

                        {/* 选择指示器 */}
                        <div className="absolute top-2 left-2">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedImages.has(image.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-white border-gray-300'
                          }`}>
                            {selectedImages.has(image.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* 悬停信息 */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-200 flex items-end opacity-0 group-hover:opacity-100">
                          <div className="p-2 text-white text-xs w-full">
                            <p className="truncate font-medium">{image.publicId}</p>
                            <p className="text-gray-300">
                              {image.width} × {image.height}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 底部操作 */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
                  共 {unassignedImages.length} 张未分组图片
                </div>
                <button
                  onClick={closeUnassignedImagesModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast通知容器 */}
      <ToastContainer
        toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))}
      />
    </div>
  )
}