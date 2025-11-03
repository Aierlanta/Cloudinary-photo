'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useLocale } from '@/hooks/useLocale'

interface APIParameter {
  name: string
  type: 'group' | 'custom'
  allowedValues: string[]
  mappedGroups: string[]
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
  const [formData, setFormData] = useState<APIParameter>({
    name: '',
    type: 'group',
    allowedValues: [],
    mappedGroups: [],
    isEnabled: true
  })
  const [newValue, setNewValue] = useState('')

  // Toast通知
  const { toasts, error: showError, removeToast } = useToast()

  useEffect(() => {
    if (parameter) {
      setFormData(parameter)
    } else {
      setFormData({
        name: '',
        type: 'group',
        allowedValues: [],
        mappedGroups: [],
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

    onSave(formData)
    onClose()
  }

  const addValue = () => {
    if (!newValue.trim()) return
    
    if (formData.allowedValues.includes(newValue.trim())) {
      alert(t.adminConfig.valueAlreadyExists)
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="transparent-panel rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold panel-text">
              {isEditing ? t.adminConfig.editApiParameter : t.adminConfig.addApiParameter}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 表单 */}
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminConfig.parameterNameLabel} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.adminConfig.parameterNamePlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminConfig.parameterTypeLabel}
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'group' | 'custom' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
                >
                  <option value="group">{t.adminConfig.groupParameterOption}</option>
                  <option value="custom">{t.adminConfig.customParameterOption}</option>
                </select>
              </div>
            </div>

            {/* 启用状态 */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm font-medium panel-text">{t.adminConfig.enableParameter}</span>
              </label>
            </div>

            {/* 允许的值 */}
            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                {t.adminConfig.allowedValuesLabel} *
              </label>
              <div className="flex mb-3">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={t.adminConfig.enterParameterValue}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
                  onKeyPress={(e) => e.key === 'Enter' && addValue()}
                />
                <button
                  onClick={addValue}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors"
                >
                  {t.adminConfig.add}
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {formData.allowedValues.map((value, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                  >
                    {value}
                    <button
                      onClick={() => removeValue(index)}
                      className="ml-2 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* 分组映射 (仅分组参数) */}
            {formData.type === 'group' && (
              <div>
                <label className="block text-sm font-medium panel-text mb-2">
                  {t.adminConfig.mappedGroupsLabel}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {t.adminConfig.mappedGroupsDesc}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {groups.map(group => (
                    <label key={group.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                      <input
                        type="checkbox"
                        checked={formData.mappedGroups.includes(group.id)}
                        onChange={() => toggleGroupMapping(group.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="ml-2 text-sm panel-text">{group.name}</span>
                      <span className="ml-auto text-xs text-gray-500">({group.imageCount})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-3 mt-8">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {isEditing ? t.adminConfig.updateParameter : t.adminConfig.addParameterButton}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              {t.adminConfig.cancel}
            </button>
          </div>
        </div>
      </div>

      {/* Toast通知容器 */}
      <ToastContainer
        toasts={toasts.map(toast => ({ ...toast, onClose: removeToast }))}
      />
    </div>
  )
}
