'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { StorageProvider } from '@/lib/storage/base'

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
  const { t } = useLocale();
  const isLight = useTheme();
  const [formData, setFormData] = useState<APIParameter>({
    name: '',
    type: 'group',
    allowedValues: [],
    mappedGroups: [],
    mappedProviders: [],
    isEnabled: true
  })
  const [newValue, setNewValue] = useState('')

  // Toast通知
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

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 !mt-0 rounded-lg">
        <div className={cn(
          "border max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <div className="p-6 rounded-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 rounded-lg">
              <h3 className={cn(
                "text-lg font-semibold",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {isEditing ? t.adminConfig.editApiParameter : t.adminConfig.addApiParameter}
              </h3>
              <button
                onClick={onClose}
                className={cn(
                  "p-2 transition-colors rounded-lg",
                  isLight
                    ? "text-gray-500 hover:bg-gray-100"
                    : "text-gray-400 hover:bg-gray-700"
                )}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="space-y-6 rounded-lg">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg">
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2 rounded-lg",
                    isLight ? "text-gray-700" : "text-gray-300"
                  )}>
                    {t.adminConfig.parameterNameLabel} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.adminConfig.parameterNamePlaceholder}
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
                    {t.adminConfig.parameterTypeLabel}
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const nextType = e.target.value as 'group' | 'custom' | 'provider'
                      setFormData({
                        ...formData,
                        type: nextType,
                        // 切换类型时，清理不相关的映射，避免配置混淆
                        mappedGroups: nextType === 'provider' ? [] : (Array.isArray(formData.mappedGroups) ? formData.mappedGroups : []),
                        mappedProviders: nextType === 'provider' ? (Array.isArray(formData.mappedProviders) ? formData.mappedProviders : []) : []
                      })
                    }}
                    className={cn(
                      "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                      isLight
                        ? "bg-white border-gray-300"
                        : "bg-gray-800 border-gray-600"
                    )}
                  >
                    <option value="group">{t.adminConfig.groupParameterOption}</option>
                    <option value="custom">{t.adminConfig.customParameterOption}</option>
                    <option value="provider">{t.adminConfig.providerParameterOption}</option>
                  </select>
                </div>
              </div>

              {/* Enable Status */}
              <div>
                <label className="flex items-center rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="w-4 h-4 border-gray-300 rounded-lg"
                  />
                  <span className={cn(
                    "ml-2 text-sm font-medium",
                    isLight ? "text-gray-700" : "text-gray-300"
                  )}>
                    {t.adminConfig.enableParameter}
                  </span>
                </label>
              </div>

              {/* Allowed Values */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2 rounded-lg",
                  isLight ? "text-gray-700" : "text-gray-300"
                )}>
                  {t.adminConfig.allowedValuesLabel} *
                </label>
                <div className="flex mb-3 rounded-lg">
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={t.adminConfig.enterParameterValue}
                    className={cn(
                      "flex-1 px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                      isLight
                        ? "bg-white border-gray-300"
                        : "bg-gray-800 border-gray-600"
                    )}
                    onKeyPress={(e) => e.key === 'Enter' && addValue()}
                  />
                  <button
                    onClick={addValue}
                    className={cn(
                      "px-4 py-2 border transition-colors rounded-lg",
                      isLight
                        ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                    )}
                  >
                    {t.adminConfig.add}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 rounded-lg">
                  {formData.allowedValues.map((value, index) => (
                    <span
                      key={index}
                      className={cn(
                        "inline-flex items-center px-3 py-1 border text-sm rounded-lg",
                        isLight
                          ? "bg-blue-50 border-blue-300 text-blue-800"
                          : "bg-blue-900/20 border-blue-600 text-blue-200"
                      )}
                    >
                      {value}
                      <button
                        onClick={() => removeValue(index)}
                        className={cn(
                          "ml-2 transition-colors rounded-lg",
                          isLight
                            ? "text-blue-600 hover:text-blue-800"
                            : "text-blue-300 hover:text-blue-100"
                        )}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Group Mapping (for group parameters) */}
              {formData.type === 'group' && (
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2 rounded-lg",
                    isLight ? "text-gray-700" : "text-gray-300"
                  )}>
                    {t.adminConfig.mappedGroupsLabel}
                  </label>
                  <p className={cn(
                    "text-xs mb-3 rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t.adminConfig.mappedGroupsDesc}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-lg">
                    {groups.map(group => (
                      <label
                        key={group.id}
                        className={cn(
                          "flex items-center p-2 border transition-colors rounded-lg",
                          isLight
                            ? "bg-white border-gray-300 hover:bg-gray-50"
                            : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                        )}>
                      >
                        <input
                          type="checkbox"
                          checked={formData.mappedGroups.includes(group.id)}
                          onChange={() => toggleGroupMapping(group.id)}
                          className="w-4 h-4 border-gray-300 rounded-lg"
                        />
                        <span className={cn(
                          "ml-2 text-sm rounded-lg",
                          isLight ? "text-gray-900" : "text-gray-100"
                        )}>
                          {group.name}
                        </span>
                        <span className={cn(
                          "ml-auto text-xs rounded-lg",
                          isLight ? "text-gray-500" : "text-gray-400"
                        )}>
                          ({group.imageCount})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Provider Mapping (for provider parameters) */}
              {formData.type === 'provider' && (
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2 rounded-lg",
                    isLight ? "text-gray-700" : "text-gray-300"
                  )}>
                    {t.adminConfig.mappedProvidersLabel}
                  </label>
                  <p className={cn(
                    "text-xs mb-3 rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t.adminConfig.mappedProvidersDesc}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-lg">
                    {Object.values(StorageProvider).map(provider => (
                      <label
                        key={provider}
                        className={cn(
                          "flex items-center p-2 border transition-colors rounded-lg",
                          isLight
                            ? "bg-white border-gray-300 hover:bg-gray-50"
                            : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                        )}>
                        <input
                          type="checkbox"
                          checked={(formData.mappedProviders || []).includes(provider)}
                          onChange={() => toggleProviderMapping(provider)}
                          className="w-4 h-4 border-gray-300 rounded-lg"
                        />
                        <span className={cn(
                          "ml-2 text-sm rounded-lg",
                          isLight ? "text-gray-900" : "text-gray-100"
                        )}>
                          {provider}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-8 rounded-lg">
              <button
                onClick={handleSave}
                className={cn(
                  "flex-1 py-2 px-4 border transition-colors rounded-lg",
                  isLight
                    ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                    : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                )}
              >
                {isEditing ? t.adminConfig.updateParameter : t.adminConfig.addParameterButton}
              </button>
              <button
                onClick={onClose}
                className={cn(
                  "flex-1 py-2 px-4 border transition-colors rounded-lg",
                  isLight
                    ? "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-700"
                    : "bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                )}
              >
                {t.adminConfig.cancel}
              </button>
            </div>
          </div>
        </div>

        <ToastContainer
          toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))}
        />
      </div>
    );
}
