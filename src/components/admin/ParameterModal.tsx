'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useLocale } from '@/hooks/useLocale'
import { StorageProvider } from '@/lib/storage/base'
import { X } from 'lucide-react'
import AdminPortal from '@/components/admin/AdminPortal'
import pageStyles from '@/app/admin/admin-pages.module.css'

interface APIParameter {
  name: string
  type: 'group' | 'custom' | 'provider'
  allowedValues: string[]
  mappedGroups: string[]
  mappedProviders?: string[]
  isEnabled: boolean
}

interface Group {
  id: string
  name: string
  description: string
  createdAt: string
  imageCount: number
}

interface ParameterModalProps {
  parameter: APIParameter | null
  groups: Group[]
  isOpen: boolean
  onClose: () => void
  onSave: (parameter: APIParameter) => void
  isEditing: boolean
}

export default function ParameterModal({
  parameter,
  groups,
  isOpen,
  onClose,
  onSave,
  isEditing
}: ParameterModalProps) {
  const { t } = useLocale()
  const [formData, setFormData] = useState<APIParameter>({
    name: '',
    type: 'group',
    allowedValues: [],
    mappedGroups: [],
    mappedProviders: [],
    isEnabled: true
  })
  const [newValue, setNewValue] = useState('')
  const { toasts, error: showError, removeToast } = useToast()

  useEffect(() => {
    if (parameter) {
      setFormData({
        ...parameter,
        mappedGroups: Array.isArray(parameter.mappedGroups) ? parameter.mappedGroups : [],
        mappedProviders: Array.isArray(parameter.mappedProviders) ? parameter.mappedProviders : []
      })
    } else {
      setFormData({
        name: '',
        type: 'group',
        allowedValues: [],
        mappedGroups: [],
        mappedProviders: [],
        isEnabled: true
      })
    }
  }, [parameter])

  const handleSave = () => {
    if (!formData.name.trim()) {
      showError(t.adminConfig.validationError, t.adminConfig.validationFailedEnterName)
      return
    }

    if (formData.allowedValues.length === 0) {
      showError(t.adminConfig.validationError, t.adminConfig.validationFailedAddValue)
      return
    }

    if (formData.type === 'provider' && (!formData.mappedProviders || formData.mappedProviders.length === 0)) {
      showError(t.adminConfig.validationError, t.adminConfig.validationFailedSelectProvider)
      return
    }

    onSave(formData)
    onClose()
  }

  const addValue = () => {
    if (!newValue.trim()) return

    if (formData.allowedValues.includes(newValue.trim())) {
      showError(t.adminConfig.valueAlreadyExists)
      return
    }

    setFormData({
      ...formData,
      allowedValues: [...formData.allowedValues, newValue.trim()]
    })
    setNewValue('')
  }

  const removeValue = (index: number) => {
    setFormData({
      ...formData,
      allowedValues: formData.allowedValues.filter((_, i) => i !== index)
    })
  }

  const toggleGroupMapping = (groupId: string) => {
    if (formData.mappedGroups.includes(groupId)) {
      setFormData({
        ...formData,
        mappedGroups: formData.mappedGroups.filter(id => id !== groupId)
      })
    } else {
      setFormData({
        ...formData,
        mappedGroups: [...formData.mappedGroups, groupId]
      })
    }
  }

  const toggleProviderMapping = (provider: string) => {
    const current = Array.isArray(formData.mappedProviders) ? formData.mappedProviders : []
    if (current.includes(provider)) {
      setFormData({
        ...formData,
        mappedProviders: current.filter(p => p !== provider)
      })
    } else {
      setFormData({
        ...formData,
        mappedProviders: [...current, provider]
      })
    }
  }

  if (!isOpen) return null

  return (
    <AdminPortal>
    <div className={pageStyles.overlayHost}>
    <div className="admin-config-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="admin-config-modal-panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{isEditing ? t.adminConfig.editApiParameter : t.adminConfig.addApiParameter}</h3>
          <button type="button" onClick={onClose} aria-label={t.common.close}>
            <X />
          </button>
        </header>

        <div className="admin-config-modal-body">
          <div className="admin-config-modal-grid">
            <label>
              <span>{t.adminConfig.parameterNameLabel} *</span>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.adminConfig.parameterNamePlaceholder}
              />
            </label>
            <label>
              <span>{t.adminConfig.parameterTypeLabel}</span>
              <select
                value={formData.type}
                onChange={(e) => {
                  const nextType = e.target.value as 'group' | 'custom' | 'provider'
                  setFormData({
                    ...formData,
                    type: nextType,
                    mappedGroups: nextType === 'provider' ? [] : (Array.isArray(formData.mappedGroups) ? formData.mappedGroups : []),
                    mappedProviders: nextType === 'provider' ? (Array.isArray(formData.mappedProviders) ? formData.mappedProviders : []) : []
                  })
                }}
              >
                <option value="group">{t.adminConfig.groupParameterOption}</option>
                <option value="custom">{t.adminConfig.customParameterOption}</option>
                <option value="provider">{t.adminConfig.providerParameterOption}</option>
              </select>
            </label>
          </div>

          <label className="admin-config-switch-row">
            <span>{t.adminConfig.enableParameter}</span>
            <span className="admin-config-switch">
              <input
                type="checkbox"
                checked={formData.isEnabled}
                onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
              />
              <i />
              <b>{formData.isEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
            </span>
          </label>

          <div className="admin-config-modal-section">
            <span>{t.adminConfig.allowedValuesLabel} *</span>
            <div className="admin-config-inline-controls">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={t.adminConfig.enterParameterValue}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
              />
              <button type="button" className="admin-config-modal-btn is-pink" onClick={addValue}>
                {t.adminConfig.add}
              </button>
            </div>
            <div className="admin-config-chip-list">
              {formData.allowedValues.map((value, index) => (
                <span key={index}>
                  {value}
                  <button type="button" aria-label={t.common.delete} onClick={() => removeValue(index)}>
                    <X />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {formData.type === 'group' && (
            <div className="admin-config-modal-section">
              <span>{t.adminConfig.mappedGroupsLabel}</span>
              <p>{t.adminConfig.mappedGroupsDesc}</p>
              <div className="admin-config-map-list">
                {groups.map((group) => (
                  <label key={group.id}>
                    <input
                      type="checkbox"
                      checked={formData.mappedGroups.includes(group.id)}
                      onChange={() => toggleGroupMapping(group.id)}
                    />
                    <b>{group.name}</b>
                    <small>({group.imageCount})</small>
                  </label>
                ))}
              </div>
            </div>
          )}

          {formData.type === 'provider' && (
            <div className="admin-config-modal-section">
              <span>{t.adminConfig.mappedProvidersLabel}</span>
              <p>{t.adminConfig.mappedProvidersDesc}</p>
              <div className="admin-config-map-list">
                {Object.values(StorageProvider).map((provider) => (
                  <label key={provider}>
                    <input
                      type="checkbox"
                      checked={(formData.mappedProviders || []).includes(provider)}
                      onChange={() => toggleProviderMapping(provider)}
                    />
                    <b>{provider}</b>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer>
          <button type="button" className="admin-config-modal-btn is-pink" onClick={handleSave}>
            {isEditing ? t.adminConfig.updateParameter : t.adminConfig.addParameterButton}
          </button>
          <button type="button" className="admin-config-modal-btn is-ghost" onClick={onClose}>
            {t.adminConfig.cancel}
          </button>
        </footer>
      </div>

      <ToastContainer
        toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))}
      />
    </div>
    </div>
    </AdminPortal>
  )
}
