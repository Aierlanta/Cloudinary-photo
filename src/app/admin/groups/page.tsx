'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useLocale } from '@/hooks/useLocale'
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  X,
  Save,
  Flower2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useAdminApi } from '@/lib/admin-api-client'
import AdminPortal from '@/components/admin/AdminPortal'
import { OrnateIcon } from '@/components/ui/ornate-icon'
import { cn } from '@/lib/utils'
import styles from '../admin-pages.module.css'

interface Group {
  id: string
  name: string
  description?: string
  createdAt: string
  imageCount: number
}

interface GroupFormData {
  name: string
  description: string
}

export default function GroupsPage() {
  const { t } = useLocale()
  const { adminFetch, selectedNodeId } = useAdminApi()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState<GroupFormData>({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const { toasts, success, error: showError, removeToast } = useToast()
  const [totalImages, setTotalImages] = useState(0)

  useEffect(() => {
    loadGroups()
    loadTotalImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId])

  const loadGroups = async () => {
    setLoading(true)
    try {
      const response = await adminFetch('/api/admin/groups')
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
      const response = await adminFetch('/api/admin/stats')
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

  const handleCreateGroup = async () => {
    if (!formData.name.trim()) {
      showError(t.adminGroups.validationError, t.adminGroups.enterGroupName)
      return
    }

    setSubmitting(true)
    try {
      const response = await adminFetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || '',
        }),
      })

      if (response.ok) {
        await loadGroups()
        await loadTotalImages()
        setFormData({ name: '', description: '' })
        setShowCreateForm(false)
        success(t.adminGroups.createSuccess, t.adminGroups.createSuccess)
      } else {
        let errMsg = t.adminGroups.createFailed
        try {
          const data = await response.json()
          errMsg = data?.error?.message || data?.message || errMsg
        } catch {
          // ignore
        }
        showError(t.adminGroups.createFailed, errMsg)
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
      showError(t.adminGroups.enterGroupName)
      return
    }

    setSubmitting(true)
    try {
      const response = await adminFetch(`/api/admin/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await loadGroups()
        await loadTotalImages()
        setEditingGroup(null)
        setFormData({ name: '', description: '' })
        success(t.adminGroups.updateSuccess)
      } else {
        showError(t.adminGroups.updateFailed)
      }
    } catch (error) {
      console.error('更新分组失败:', error)
      showError(t.adminGroups.updateFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingGroup) await handleUpdateGroup()
    else await handleCreateGroup()
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(t.adminUi.confirmDeleteGroupAffected.replace('{name}', groupName))) {
      return
    }

    try {
      const response = await adminFetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
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
    setFormData({ name: group.name, description: group.description || '' })
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
    router.push(`/admin/gallery?groupId=${group.id}`)
  }

  const averageImages =
    groups.length > 0
      ? Math.round(groups.reduce((sum, group) => sum + group.imageCount, 0) / groups.length)
      : 0

  return (
    <div className={`${styles.page} admin-groups-page`}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            <span>{t.adminNav.groups}</span>
            <OrnateIcon icon={Flower2} tone="pink" size="sm" className={styles.heroIconBadge} />
          </h1>
          <p className={styles.heroSubtitle}>{t.adminGroups.description}</p>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={cn(styles.btn, styles.btnLavender)} onClick={loadGroups}>
            <OrnateIcon icon={RefreshCw} tone="lavender" size="sm" />
            {t.common.refresh}
          </button>
          <button type="button" className={cn(styles.btn, styles.btnPink)} onClick={startCreate}>
            <OrnateIcon icon={Plus} tone="cream" size="sm" />
            {t.adminGroups.createGroup}
          </button>
        </div>
      </header>

      <div className={styles.ribbon}>
        <OrnateIcon icon={Sparkles} tone="pink" size="sm" />
        <OrnateIcon icon={Layers} tone="lavender" size="sm" />
        <span>{t.adminUi.allGroups}</span>
        <OrnateIcon icon={Sparkles} tone="pink" size="sm" />
      </div>

      <section className={styles.metrics} aria-label={t.adminNav.groups}>
        <article className={styles.metric}>
          <span className={cn(styles.metricArtwork, styles.groupArtworkTag)} aria-hidden="true" />
          <span>{t.adminDashboard.groupCount}</span>
          <strong>{groups.length}</strong>
        </article>
        <article className={styles.metric}>
          <span className={cn(styles.metricArtwork, styles.groupArtworkAlbum)} aria-hidden="true" />
          <span>{t.adminGroups.totalImages}</span>
          <strong>{totalImages}</strong>
        </article>
        <article className={styles.metric}>
          <span className={cn(styles.metricArtwork, styles.groupArtworkCheck)} aria-hidden="true" />
          <span>{t.adminUi.avgPerGroup}</span>
          <strong>{averageImages}</strong>
        </article>
      </section>

      {(showCreateForm || editingGroup) && (
        <AdminPortal>
          <div
            className={styles.modalBackdrop}
            onClick={editingGroup ? cancelEdit : () => setShowCreateForm(false)}
          >
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative z-[1] flex items-center justify-between mb-4">
                <h3 className={styles.panelTitle} style={{ marginBottom: 0 }}>
                  {editingGroup ? t.adminGroups.editGroup : t.adminGroups.createGroup}
                </h3>
                <button
                  type="button"
                  onClick={editingGroup ? cancelEdit : () => setShowCreateForm(false)}
                  className={styles.iconBtn}
                  aria-label={t.common.close}
                >
                  <OrnateIcon icon={X} tone="pink" size="sm" />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className={styles.field}>
                  <label htmlFor="group-name">{t.adminGroups.groupName}</label>
                  <input
                    id="group-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="group-desc">{t.adminGroups.description}</label>
                  <textarea
                    id="group-desc"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button type="submit" disabled={submitting} className={cn(styles.btn, styles.btnPink, 'flex-1 justify-center')}>
                    <OrnateIcon icon={Save} tone="cream" size="sm" />
                    {submitting ? (editingGroup ? t.adminGroups.updating : t.adminGroups.creating) : t.common.save}
                  </button>
                  <button
                    type="button"
                    onClick={editingGroup ? cancelEdit : () => setShowCreateForm(false)}
                    className={cn(styles.btn, styles.btnGhost, 'flex-1 justify-center')}
                  >
                    {t.adminGroups.cancel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </AdminPortal>
      )}

      <section className={styles.cardGrid} aria-label={t.adminNav.groups}>
        {loading ? (
          <div className={cn(styles.panel, 'col-span-full')}>
            <div className={styles.empty}>{t.common.loading}</div>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <article key={group.id} className={styles.groupCard}>
                <div className="relative z-[1] flex items-start justify-between gap-2">
                  <OrnateIcon icon={Layers} tone="lavender" size="sm" className="shrink-0 mt-1" />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(group)}
                      className={styles.iconBtn}
                      aria-label={t.common.edit}
                    >
                      <OrnateIcon icon={Edit2} tone="lavender" size="sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className={cn(styles.iconBtn, styles.iconBtnDanger)}
                      aria-label={t.common.delete}
                    >
                      <OrnateIcon icon={Trash2} tone="pink" size="sm" />
                    </button>
                  </div>
                </div>
                <h3 className={styles.groupName}>{group.name}</h3>
                <p className={styles.groupId}>{group.id}</p>
                <p className={styles.groupDesc}>
                  {group.description || "—"}
                </p>
                <div className={styles.groupMeta}>
                  <span className={styles.groupCount}>
                    <OrnateIcon icon={ImageIcon} tone="pink" size="sm" />
                    {group.imageCount} {t.adminGroups.images}
                  </span>
                  <button
                    type="button"
                    onClick={() => viewGroupImages(group)}
                    className={cn(styles.btn, styles.btnGhost)}
                    style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                  >
                    View Images
                  </button>
                </div>
              </article>
            ))}

            <button type="button" className={styles.createCard} onClick={startCreate}>
              <span className={styles.createPlus}>
                <OrnateIcon icon={Plus} tone="pink" size="md" />
              </span>
              <strong>{t.adminGroups.createGroup}</strong>
              <small>{t.adminGroups.description}</small>
            </button>
          </>
        )}
      </section>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  )
}
