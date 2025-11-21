'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useLocale } from '@/hooks/useLocale'
import Image from 'next/image'
import { generateThumbnailUrlForImage } from '@/lib/image-utils'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { 
  Layers, 
  Plus, 
  FolderOpen, 
  Edit2, 
  Trash2, 
  Image as ImageIcon,
  X,
  Save,
  Grid,
  Search,
  Check,
  Move
} from 'lucide-react'

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
  primaryProvider?: string
  backupProvider?: string
  telegramFileId?: string | null
  telegramThumbnailFileId?: string | null
  telegramFilePath?: string | null
  telegramThumbnailPath?: string | null
  telegramBotToken?: string | null
  storageMetadata?: string | null
}

export default function GroupsPage() {
  const { t } = useLocale();
  const isLight = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState<GroupFormData>({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showUnassignedImages, setShowUnassignedImages] = useState(false)
  const [unassignedImages, setUnassignedImages] = useState<Image[]>([])
  const [loadingUnassignedImages, setLoadingUnassignedImages] = useState(false)
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


  const loadUnassignedImages = async () => {
    setLoadingUnassignedImages(true)
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
      setLoadingUnassignedImages(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!formData.name.trim()) {
      showError(t.adminGroups.validationError, t.adminGroups.enterGroupName)
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
        success(t.adminGroups.createSuccess, t.adminGroups.createSuccess)
      } else {
        showError(t.adminGroups.createFailed, t.adminGroups.createFailed)
      }
    } catch (error) {
      console.error('创建分组失败:', error)
      showError(t.adminGroups.createFailed, t.adminGroups.createFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateGroup = async () => {
    if (!editingGroup || !formData.name.trim()) {
      alert(t.adminGroups.enterGroupName)
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
        alert(t.adminGroups.updateSuccess)
      } else {
        alert(t.adminGroups.updateFailed)
      }
    } catch (error) {
      console.error('更新分组失败:', error)
      alert(t.adminGroups.updateFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingGroup) {
      await handleUpdateGroup()
    } else {
      await handleCreateGroup()
    }
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`${t.adminGroups.confirmDelete} "${groupName}"？此操作将会影响该分组下的所有图片。`)) {
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
        success(t.adminGroups.deleteSuccess, data.data.message)
        await loadGroups()
        await loadTotalImages()
      } else {
        showError(t.adminGroups.deleteFailed, t.adminGroups.deleteFailed)
      }
    } catch (error) {
      console.error('删除分组失败:', error)
      showError(t.adminGroups.deleteFailed, t.adminGroups.deleteFailed)
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

  const viewGroupImages = (group: Group) => {
    // 跳转到图库页面并传递分组ID
    router.push(`/admin/gallery?groupId=${group.id}`)
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
      alert(t.adminGroups.selectImagesAndGroup)
      return
    }

    try {
      // 使用批量更新API
      const response = await fetch('/api/admin/images', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin123'
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedImages),
          updates: { groupId: assigningToGroup }
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`${t.adminGroups.assignSuccess} ${selectedImages.size} ${t.adminGroups.images}`)
        await loadUnassignedImages()
        await loadGroups()
        await loadTotalImages()
        clearSelection()
        setAssigningToGroup('')
      } else {
        alert(t.adminGroups.assignFailed)
      }
    } catch (error) {
      console.error('分配图片失败:', error)
      alert(t.adminGroups.assignFailed)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  return (
      <div className="space-y-6 rounded-lg">
        {/* Header & Stats */}
        <div className={cn(
          "border p-6 rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <div className="flex flex-col gap-8 rounded-lg">
            <div className="flex justify-between items-end rounded-lg">
              <div>
                <h1 className={cn(
                  "text-3xl font-bold mb-2 rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminGroups.title}
                </h1>
                <p className={cn(
                  "text-sm rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminGroups.description}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={showUnassignedImagesModal}
                  className={cn(
                    "px-4 py-2 border flex items-center gap-2 transition-colors rounded-lg",
                    isLight
                      ? "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
                      : "bg-orange-600 text-white border-orange-500 hover:bg-orange-700"
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  {t.adminGroups.manageUnassigned}
                </button>
                <button
                  onClick={startCreate}
                  className={cn(
                    "px-4 py-2 border flex items-center gap-2 transition-colors rounded-lg",
                    isLight
                      ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                      : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  {t.adminGroups.createGroup}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg">
              <div className={cn(
                "border p-6 rounded-lg",
                isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
              )}>
                <p className={cn(
                  "text-sm font-medium mb-2 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminGroups.totalImages}
                </p>
                <div className={cn(
                  "text-3xl font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {totalImages}
                </div>
              </div>
              <div className={cn(
                "border p-6 rounded-lg",
                isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
              )}>
                <p className={cn(
                  "text-sm font-medium mb-2 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminGroups.groupsCount}
                </p>
                <div className={cn(
                  "text-3xl font-bold rounded-lg",
                  isLight ? "text-blue-600" : "text-blue-400"
                )}>
                  {groups.length}
                </div>
              </div>
              <div className={cn(
                "border p-6 rounded-lg",
                isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
              )}>
                <p className={cn(
                  "text-sm font-medium mb-2 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminGroups.groupsWithImages}
                </p>
                <div className={cn(
                  "text-3xl font-bold rounded-lg",
                  isLight ? "text-green-600" : "text-green-400"
                )}>
                  {groups.filter(g => g.imageCount > 0).length}
                </div>
              </div>
              <div className={cn(
                "border p-6 rounded-lg",
                isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
              )}>
                <p className={cn(
                  "text-sm font-medium mb-2 rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminGroups.averageImages}
                </p>
                <div className={cn(
                  "text-3xl font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {groups.length > 0 ? Math.round(groups.reduce((sum, group) => sum + group.imageCount, 0) / groups.length) : 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create / Edit Modal */}
        {(showCreateForm || editingGroup) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 !mt-0 rounded-lg">
            <div className={cn(
              "border max-w-lg w-full rounded-lg",
              isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
            )}>
              <div className="p-6 rounded-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 rounded-lg">
                  <h3 className={cn(
                    "text-lg font-semibold",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {editingGroup ? t.adminGroups.editGroup : t.adminGroups.createGroup}
                  </h3>
                  <button
                    onClick={editingGroup ? cancelEdit : () => setShowCreateForm(false)}
                    className={cn(
                      "p-2 transition-colors rounded-lg",
                      isLight
                        ? "text-gray-500 hover:bg-gray-100"
                        : "text-gray-400 hover:bg-gray-700"
                    )}
                  >
                    <X className="w-5 h-5 rounded-lg" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2 rounded-lg",
                      isLight ? "text-gray-700" : "text-gray-300"
                    )}>
                      {t.adminGroups.groupName}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className={cn(
                        "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                        isLight
                          ? "bg-white border-gray-300"
                          : "bg-gray-800 border-gray-600"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2 rounded-lg",
                      isLight ? "text-gray-700" : "text-gray-300"
                    )}>
                      {t.adminGroups.description}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className={cn(
                        "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                        isLight
                          ? "bg-white border-gray-300"
                          : "bg-gray-800 border-gray-600"
                      )}
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-6 rounded-lg">
                    <button
                      type="submit"
                      disabled={submitting}
                      className={cn(
                        "flex-1 py-2 px-4 border flex items-center justify-center gap-2 transition-colors disabled:opacity-50 rounded-lg",
                        isLight
                          ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                          : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                      )}
                    >
                      <Save className="w-4 h-4" />
                      {submitting ? '保存中...' : t.common.save}
                    </button>
                    <button
                      type="button"
                      onClick={editingGroup ? cancelEdit : () => setShowCreateForm(false)}
                      className={cn(
                        "flex-1 py-2 px-4 border transition-colors rounded-lg",
                        isLight
                          ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                          : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                      )}
                    >
                      {t.adminGroups.cancel}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Groups List */}
        <div className={cn(
          "border p-6 rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <h2 className={cn(
            "text-lg font-semibold mb-4 rounded-lg",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            {t.adminGroups.title || '分组管理'}
          </h2>
          {loading ? (
            <div className="text-center py-8 rounded-lg">
              <div className={cn(
                "w-8 h-8 border-2 border-t-transparent animate-spin mx-auto rounded-lg",
                isLight ? "border-blue-500" : "border-blue-600"
              )}></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 rounded-lg">
              <p className={isLight ? "text-gray-600" : "text-gray-400"}>
                {t.adminGroups.noGroups}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    "border p-4 transition-colors rounded-lg",
                    isLight
                      ? "bg-gray-50 border-gray-300 hover:bg-gray-100"
                      : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                  )}
                >
                  <div className="flex justify-between items-start mb-3 rounded-lg">
                    <div className="flex-1">
                      <h3 className={cn(
                        "font-semibold mb-1 rounded-lg",
                        isLight ? "text-gray-900" : "text-gray-100"
                      )}>
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className={cn(
                          "text-sm rounded-lg",
                          isLight ? "text-gray-600" : "text-gray-400"
                        )}>
                          {group.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(group)}
                        className={cn(
                          "p-2 transition-colors rounded-lg",
                          isLight
                            ? "text-blue-600 hover:bg-blue-50"
                            : "text-blue-400 hover:bg-blue-900/20"
                        )}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className={cn(
                          "p-2 transition-colors rounded-lg",
                          isLight
                            ? "text-red-600 hover:bg-red-50"
                            : "text-red-400 hover:bg-red-900/20"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 rounded-lg">
                      <ImageIcon className={cn(
                        "w-4 h-4",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )} />
                      <span className={cn(
                        "text-sm rounded-lg",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )}>
                        {group.imageCount} {t.adminGroups.images}
                      </span>
                    </div>
                    <button
                      onClick={() => viewGroupImages(group)}
                      className={cn(
                        "px-3 py-1 text-sm border transition-colors rounded-lg",
                        isLight
                          ? "bg-white border-gray-300 hover:bg-gray-50"
                          : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                      )}
                    >
                      {t.adminGroups.viewImages}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unassigned Images Modal */}
        {showUnassignedImages && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 rounded-lg">
            <div
              className={cn(
                "w-full max-w-6xl h-[90vh] border flex flex-col rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
              )}
            >
              <div className={cn(
                "p-4 border-b flex items-center justify-between shrink-0 rounded-lg",
                isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
              )}>
                <h2 className={cn(
                  "text-xl font-bold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminGroups.totalUnassignedImages.replace('{count}', unassignedImages.length.toString()) || `共 ${unassignedImages.length} 张未分组图片`}
                </h2>
                <button
                  onClick={() => setShowUnassignedImages(false)}
                  className={cn(
                    "p-2 transition-colors rounded-lg",
                    isLight
                      ? "text-gray-500 hover:bg-gray-100"
                      : "text-gray-400 hover:bg-gray-700"
                  )}
                >
                  <X className="w-5 h-5 rounded-lg" />
                </button>
              </div>
              {selectedImages.size > 0 && (
                <div className={cn(
                  "mb-4 p-4 border flex flex-wrap items-center justify-between gap-4 shrink-0 rounded-lg",
                  isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
                )}>
                  <div className="flex items-center gap-4 rounded-lg">
                    <span className={cn(
                      "text-sm font-medium rounded-lg",
                      isLight ? "text-gray-900" : "text-gray-100"
                    )}>
                      {selectedImages.size} selected
                    </span>
                    <div className="flex gap-2 rounded-lg">
                      <button
                        onClick={selectAllImages}
                        className={cn(
                          "text-xs px-3 py-1.5 border transition-colors rounded-lg",
                          isLight
                            ? "bg-white border-gray-300 hover:bg-gray-50"
                            : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                        )}
                      >
                        All
                      </button>
                      <button
                        onClick={clearSelection}
                        className={cn(
                          "text-xs px-3 py-1.5 border transition-colors rounded-lg",
                          isLight
                            ? "bg-white border-gray-300 hover:bg-gray-50"
                            : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                        )}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {selectedImages.size > 0 && (
                    <div className="flex items-center gap-3 rounded-lg">
                      <select
                        value={assigningToGroup}
                        onChange={(e) => setAssigningToGroup(e.target.value)}
                        className={cn(
                          "border text-sm p-2 outline-none focus:border-blue-500 rounded-lg",
                          isLight
                            ? "bg-white border-gray-300"
                            : "bg-gray-800 border-gray-600"
                        )}
                      >
                        <option value="">Select Group...</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={assignImagesToGroup}
                        disabled={!assigningToGroup}
                        className={cn(
                          "px-4 py-2 border flex items-center gap-2 transition-colors disabled:opacity-50 rounded-lg",
                          isLight
                            ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                            : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                        )}
                      >
                        <Move className="w-4 h-4" />
                        Assign
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 rounded-lg">
                {loadingUnassignedImages ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 rounded-lg">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "aspect-square animate-pulse rounded-lg",
                          isLight ? "bg-gray-200" : "bg-gray-700"
                        )}
                      />
                    ))}
                  </div>
                ) : unassignedImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 rounded-lg">
                    <Check className={cn(
                      "w-16 h-16 mb-4 rounded-lg",
                      isLight ? "text-green-500" : "text-green-400"
                    )} />
                    <p className={isLight ? "text-gray-600" : "text-gray-400"}>
                      {t.adminGroups.allImagesAssigned}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 rounded-lg">
                    {unassignedImages.map((image) => (
                      <div
                        key={image.id}
                        className={cn(
                          "relative group aspect-square overflow-hidden cursor-pointer transition-colors border rounded-lg",
                          selectedImages.has(image.id)
                            ? isLight
                              ? "border-blue-500"
                              : "border-blue-400"
                            : isLight
                            ? "border-gray-300"
                            : "border-gray-600"
                        )}
                        onClick={() => toggleImageSelection(image.id)}
                      >
                        <Image
                          src={generateThumbnailUrlForImage(image, 300)}
                          alt={image.publicId}
                          fill
                          className="object-cover"
                        />
                        {selectedImages.has(image.id) && (
                          <div className={cn(
                            "absolute inset-0 flex items-center justify-center rounded-lg",
                            isLight ? "bg-blue-500/20" : "bg-blue-600/20"
                          )}>
                            <div className={cn(
                              "p-1 rounded-lg",
                              isLight ? "bg-blue-500" : "bg-blue-600"
                            )}>
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
      </div>
    );
}