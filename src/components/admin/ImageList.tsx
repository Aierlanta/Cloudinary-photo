'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

interface ImageItem {
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

interface Group {
  id: string
  name: string
  description: string
  createdAt: string
  imageCount: number
}

interface ImageListProps {
  images: ImageItem[]
  groups: Group[]
  loading: boolean
  onDeleteImage: (imageId: string) => void
  onBulkDelete?: (imageIds: string[]) => void
  onUpdateImage?: (imageId: string, updates: { groupId?: string; tags?: string[] }) => void
}

interface ImagePreviewModalProps {
  image: ImageItem | null
  groups: Group[]
  onClose: () => void
}

interface ImageEditModalProps {
  image: ImageItem | null
  groups: Group[]
  onClose: () => void
  onSave: (imageId: string, updates: { groupId?: string; tags?: string[] }) => void
}

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
}

function LazyImage({ src, alt, className, onClick }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {!isInView ? (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <Image
            src={src}
            alt={alt}
            fill
            className={`object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            } ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
            onLoad={() => setIsLoaded(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
        </>
      )}
    </div>
  )
}

function ImagePreviewModal({ image, groups, onClose }: ImagePreviewModalProps) {
  if (!image) return null

  const group = groups.find(g => g.id === image.groupId)
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('已复制到剪贴板')
  }

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('下载图片失败:', error)
      alert('下载图片失败')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="transparent-panel rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold panel-text">图片详情</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 图片预览 */}
            <div className="space-y-4">
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                <Image
                  src={image.secureUrl}
                  alt={image.filename}
                  width={image.width}
                  height={image.height}
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
              
              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => window.open(image.secureUrl, '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  查看原图
                </button>
                <button
                  onClick={() => downloadImage(image.secureUrl, image.filename)}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  下载图片
                </button>
                <button
                  onClick={() => copyToClipboard(image.secureUrl)}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  复制链接
                </button>
                <button
                  onClick={() => copyToClipboard(image.publicId)}
                  className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  复制ID
                </button>
              </div>
            </div>

            {/* 图片信息 */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium panel-text mb-2">基本信息</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">文件名:</span>
                    <span className="panel-text font-mono">{image.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">格式:</span>
                    <span className="panel-text uppercase">{image.format}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">尺寸:</span>
                    <span className="panel-text">{image.width} × {image.height}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">大小:</span>
                    <span className="panel-text">{formatFileSize(image.bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">上传时间:</span>
                    <span className="panel-text">{formatDate(image.uploadedAt)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium panel-text mb-2">分组信息</h4>
                <div className="text-sm">
                  {group ? (
                    <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      {group.name}
                    </span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">未分组</span>
                  )}
                </div>
              </div>

              {image.tags.length > 0 && (
                <div>
                  <h4 className="font-medium panel-text mb-2">标签</h4>
                  <div className="flex flex-wrap gap-1">
                    {image.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium panel-text mb-2">Cloudinary信息</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">Public ID:</span>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs break-all">
                      {image.publicId}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">安全URL:</span>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs break-all">
                      {image.secureUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageEditModal({ image, groups, onClose, onSave }: ImageEditModalProps) {
  const [groupId, setGroupId] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (image) {
      setGroupId(image.groupId || '')
      setTags(image.tags.join(', '))
    }
  }, [image])

  if (!image) return null

  const handleSave = () => {
    const updates: { groupId?: string; tags?: string[] } = {}

    // 处理分组更新
    if (groupId !== (image.groupId || '')) {
      updates.groupId = groupId || undefined
    }

    // 处理标签更新
    const newTags = tags.split(',').map(tag => tag.trim()).filter(Boolean)
    if (JSON.stringify(newTags) !== JSON.stringify(image.tags)) {
      updates.tags = newTags
    }

    if (Object.keys(updates).length > 0) {
      onSave(image.id, updates)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="transparent-panel rounded-lg max-w-md w-full">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold panel-text">编辑图片</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 图片预览 */}
          <div className="mb-4">
            <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <Image
                src={image.secureUrl}
                alt={image.filename}
                width={image.width}
                height={image.height}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 panel-text mt-2 truncate">
              {image.filename}
            </p>
          </div>

          {/* 编辑表单 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                分组
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
              >
                <option value="">未分组</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                标签 (用逗号分隔)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如: 风景, 自然, 蓝天"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              保存
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ImageList({ images, groups, loading, onDeleteImage, onBulkDelete, onUpdateImage }: ImageListProps) {
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null)
  const [editingImage, setEditingImage] = useState<ImageItem | null>(null)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN')
  }

  const getGroupName = (groupId?: string) => {
    if (!groupId) return '未分组'
    const group = groups.find(g => g.id === groupId)
    return group?.name || '未知分组'
  }

  // 批量操作相关函数
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
    setSelectedImages(new Set(images.map(img => img.id)))
  }

  const clearSelection = () => {
    setSelectedImages(new Set())
    setBulkMode(false)
  }

  const handleBulkDelete = () => {
    if (selectedImages.size === 0) return

    if (confirm(`确定要删除选中的 ${selectedImages.size} 张图片吗？`)) {
      onBulkDelete?.(Array.from(selectedImages))
      clearSelection()
    }
  }

  const handleEditImage = (imageId: string, updates: { groupId?: string; tags?: string[] }) => {
    onUpdateImage?.(imageId, updates)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* 图片骨架 */}
            <div className="aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            {/* 信息骨架 */}
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="flex justify-between">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium panel-text mb-2">暂无图片</h3>
        <p className="text-gray-500 dark:text-gray-400 panel-text">
          还没有上传任何图片，点击上方的上传区域开始添加图片吧！
        </p>
      </div>
    )
  }

  return (
    <>
      {/* 批量操作工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              bulkMode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {bulkMode ? '退出批量模式' : '批量操作'}
          </button>

          {bulkMode && (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-400 panel-text">
                已选择 {selectedImages.size} 张图片
              </span>

              {selectedImages.size > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                  >
                    删除选中
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                  >
                    取消选择
                  </button>
                </div>
              )}

              {images.length > 0 && (
                <button
                  onClick={selectAllImages}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  全选
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className={`group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-all ${
              selectedImages.has(image.id)
                ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {/* 批量选择模式下的选择框 */}
            {bulkMode && (
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedImages.has(image.id)}
                  onChange={() => toggleImageSelection(image.id)}
                  className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
              </div>
            )}

            {/* 图片预览 */}
            <div className="aspect-square relative bg-gray-100 dark:bg-gray-800">
              <LazyImage
                src={image.secureUrl}
                alt={image.filename}
                className="w-full h-full"
                onClick={() => {
                  if (bulkMode) {
                    toggleImageSelection(image.id)
                  } else {
                    setSelectedImage(image)
                  }
                }}
              />

              {/* 悬停操作按钮 - 非批量模式下显示 */}
              {!bulkMode && (
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedImage(image)
                      }}
                      className="bg-white text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      title="查看详情"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingImage(image)
                      }}
                      className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors"
                      title="编辑图片"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteImage(image.id)
                      }}
                      className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                      title="删除图片"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 图片信息 */}
            <div className="p-3">
              <h3 className="font-medium panel-text truncate mb-1" title={image.filename}>
                {image.filename}
              </h3>

              {/* 基本信息 */}
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {image.width} × {image.height}
                  </span>
                  <span className="flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {formatFileSize(image.bytes)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center truncate">
                    <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="truncate">{getGroupName(image.groupId)}</span>
                  </span>
                  <span className="flex items-center flex-shrink-0 ml-2">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDate(image.uploadedAt)}
                  </span>
                </div>
              </div>

              {/* 标签 */}
              {image.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {image.tags.slice(0, 2).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs"
                    >
                      <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {tag}
                    </span>
                  ))}
                  {image.tags.length > 2 && (
                    <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      +{image.tags.length - 2}
                    </span>
                  )}
                </div>
              )}

              {/* 格式标识 */}
              <div className="mt-2 flex justify-between items-center">
                <span className="inline-flex items-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs font-mono uppercase">
                  {image.format}
                </span>
                {bulkMode && selectedImages.has(image.id) && (
                  <span className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded text-xs">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    已选择
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 图片预览模态框 */}
      <ImagePreviewModal
        image={selectedImage}
        groups={groups}
        onClose={() => setSelectedImage(null)}
      />

      {/* 图片编辑模态框 */}
      <ImageEditModal
        image={editingImage}
        groups={groups}
        onClose={() => setEditingImage(null)}
        onSave={handleEditImage}
      />
    </>
  )
}