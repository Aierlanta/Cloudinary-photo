'use client'

import { useState, useEffect, useCallback } from 'react'
import ParameterModal from '@/components/admin/ParameterModal'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { 
  Settings, 
  Shield, 
  Globe, 
  Key, 
  Database, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Copy, 
  ExternalLink, 
  Play, 
  Save 
} from 'lucide-react'

interface APIParameter {
  name: string
  type: 'group' | 'custom'
  allowedValues: string[]
  mappedGroups: string[]
  isEnabled: boolean
}

interface APIConfig {
  id: string
  isEnabled: boolean
  defaultScope: 'all' | 'groups'
  defaultGroups: string[]
  allowedParameters: APIParameter[]
  enableDirectResponse: boolean
  apiKeyEnabled: boolean
  apiKey?: string
  updatedAt: string
}

interface Group {
  id: string
  name: string
  description: string
  createdAt: string
  imageCount: number
}

export default function ConfigPage() {
  const { t } = useLocale();
  const isLight = useTheme();
  const [config, setConfig] = useState<APIConfig | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingParameter, setEditingParameter] = useState<APIParameter | null>(null)
  const [showAddParameter, setShowAddParameter] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newParameter, setNewParameter] = useState<Partial<APIParameter>>({
    name: '',
    type: 'group',
    allowedValues: [],
    mappedGroups: [],
    isEnabled: true
  })
  const [testUrl, setTestUrl] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)
const {
  toasts,
  success: showSuccess,
  error: showError,
  warning: showWarning,
  removeToast
} = useToast()

  const getDefaultConfig = (): APIConfig => ({
    id: 'default',
    isEnabled: true,
    defaultScope: 'all',
    defaultGroups: [],
    allowedParameters: [],
    enableDirectResponse: false,
    apiKeyEnabled: false,
    apiKey: '',
    updatedAt: new Date().toISOString()
  })

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/config')
      if (response.ok) {
        const data = await response.json()
        const loadedConfig = data.data?.config || getDefaultConfig()
        // 确保字段存在
        if (loadedConfig.enableDirectResponse === undefined) {
          loadedConfig.enableDirectResponse = false
        }
        if (loadedConfig.apiKeyEnabled === undefined) {
          loadedConfig.apiKeyEnabled = false
        }
        if (loadedConfig.apiKey === undefined) {
          loadedConfig.apiKey = ''
        }
        setConfig(loadedConfig)
      } else {
        setConfig(getDefaultConfig())
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      setConfig(getDefaultConfig())
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.data?.groups || [])
      }
    } catch (error) {
      console.error('加载分组失败:', error)
    }
  }, [])

  // 加载配置和分组
  useEffect(() => {
    loadConfig()
    loadGroups()
  }, [loadConfig, loadGroups])

  const saveConfig = async () => {
    if (!config) {
      showError(t.adminConfig.saveFailed)
      return
    }

    // 验证配置数据
    if (!config.defaultScope || !['all', 'groups'].includes(config.defaultScope)) {
      showWarning(t.adminConfig.invalidDefaultScope)
      return
    }

    // 验证参数配置
    for (const param of config.allowedParameters) {
      if (!param.name || param.name.trim() === '') {
        showWarning(t.adminConfig.invalidParameterName)
        return
      }
      if (!param.type || !['group', 'custom'].includes(param.type)) {
        showWarning(t.adminConfig.invalidParameterType)
        return
      }
      if (!param.allowedValues || param.allowedValues.length === 0) {
        showWarning(t.adminConfig.invalidAllowedValues)
        return
      }
      if (!param.mappedGroups || !Array.isArray(param.mappedGroups)) {
        showWarning(t.adminConfig.invalidMappedGroups)
        return
      }
    }

    const requestData = {
      isEnabled: config.isEnabled,
      defaultScope: config.defaultScope,
      defaultGroups: config.defaultGroups,
      allowedParameters: config.allowedParameters,
      enableDirectResponse: config.enableDirectResponse,
      apiKeyEnabled: config.apiKeyEnabled,
      apiKey: config.apiKey
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        const data = await response.json()
        showSuccess(data.message || t.adminConfig.saveSuccess)
        await loadConfig()
      } else {
        const errorData = await response.json()
        showError(errorData.error?.message || `${t.adminConfig.saveFailed} (${response.status}: ${response.statusText})`)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      showError(`${t.adminConfig.saveFailed}: ${error instanceof Error ? error.message : '网络错误'}`)
    } finally {
      setSaving(false)
    }
  }

  const addParameter = (parameter: APIParameter) => {
    if (!config) return

    setConfig({
      ...config,
      allowedParameters: [...config.allowedParameters, parameter]
    })

    setNewParameter({
      name: '',
      type: 'group',
      allowedValues: [],
      mappedGroups: [],
      isEnabled: true
    })
    setShowAddParameter(false)
  }

  const updateParameter = (index: number, updatedParameter: APIParameter) => {
    if (!config) return

    const newParameters = [...config.allowedParameters]
    newParameters[index] = updatedParameter
    setConfig({
      ...config,
      allowedParameters: newParameters
    })
  }

  const deleteParameter = (index: number) => {
    if (!config) return

    const newParameters = config.allowedParameters.filter((_, i) => i !== index)
    setConfig({
      ...config,
      allowedParameters: newParameters
    })
  }

  const generateApiUrl = (endpoint: 'random' | 'response' = 'random') => {
    if (typeof window === 'undefined') return ''
    const baseUrl = `${window.location.protocol}//${window.location.host}`
    return `${baseUrl}/api/${endpoint}`
  }

  const generateExampleUrls = () => {
    if (!config) return []

    const randomBaseUrl = generateApiUrl('random')
    const responseBaseUrl = generateApiUrl('response')
    const examples = [
      { label: t.adminConfig.exampleRandom, url: randomBaseUrl },
      ...(config.enableDirectResponse ? [{ label: t.adminConfig.exampleResponse, url: responseBaseUrl }] : [])
    ]

    config.allowedParameters.forEach(param => {
      if (param.isEnabled && param.allowedValues.length > 0) {
        examples.push({
          label: `${t.adminConfig.exampleWithParameter} (${param.name}=${param.allowedValues[0]})`,
          url: `${randomBaseUrl}?${param.name}=${param.allowedValues[0]}`
        })
        if (config.enableDirectResponse) {
          examples.push({
            label: `${t.adminConfig.exampleResponseWithParameter} (${param.name}=${param.allowedValues[0]})`,
            url: `${responseBaseUrl}?${param.name}=${param.allowedValues[0]}`
          })
        }
      }
    })

    return examples
  }

  const testApi = async () => {
    if (!testUrl) return

    setTesting(true)
    try {
      const response = await fetch(testUrl)
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        success: response.ok
      })
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : '测试失败',
        success: false
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className={cn(
        "border p-6 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div className="animate-pulse rounded-lg">
          <div className={cn(
            "h-8 mb-4 rounded-lg",
            isLight ? "bg-gray-200" : "bg-gray-700"
          )} style={{ width: '25%' }}></div>
          <div className={cn(
            "h-4 rounded-lg",
            isLight ? "bg-gray-200" : "bg-gray-700"
          )} style={{ width: '75%' }}></div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={cn(
        "border p-6 rounded-lg",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <h1 className={cn(
          "text-2xl font-bold mb-4 rounded-lg",
          isLight ? "text-gray-900" : "text-gray-100"
        )}>
          {t.adminConfig.title}
        </h1>
        <p className={cn(
          "text-red-600 rounded-lg",
          isLight ? "text-red-600" : "text-red-400"
        )}>
          {t.adminConfig.loadFailed}
        </p>
      </div>
    );
  }

  return (
      <div className="space-y-6 pb-20 rounded-lg">
        {/* Header */}
        <div className={cn(
          "border p-6 flex justify-between items-start rounded-lg",
          isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
        )}>
          <div>
            <h1 className={cn(
              "text-3xl font-bold mb-2 rounded-lg",
              isLight ? "text-gray-900" : "text-gray-100"
            )}>
              {t.adminConfig.title}
            </h1>
            <p className={cn(
              "text-gray-600 rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              {t.adminConfig.description}
            </p>
          </div>
          <button
            onClick={saveConfig}
            disabled={saving}
            className={cn(
              "px-4 py-2 border flex items-center gap-2 transition-colors disabled:opacity-50 rounded-lg",
              isLight
                ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? t.adminConfig.saving : t.adminConfig.saveConfig}
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg">
          <div className={cn(
            "border p-6 flex items-center justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                config.isEnabled
                  ? isLight ? "bg-green-500" : "bg-green-600"
                  : isLight ? "bg-red-500" : "bg-red-600"
              )}>
                <Globe className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h3 className={cn(
                  "font-semibold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminConfig.apiStatus}
                </h3>
                <p className={cn(
                  "text-sm rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminConfig.enablePublicAPI}
                </p>
              </div>
            </div>
            <label className="relative inline-block w-12 h-6 cursor-pointer rounded-lg">
              <input
                type="checkbox"
                name="toggle"
                id="toggle-api"
                checked={config.isEnabled}
                onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                className="sr-only"
              />
              <span className={cn(
                "absolute inset-0 transition-colors rounded-lg",
                config.isEnabled
                  ? isLight ? "bg-green-500" : "bg-green-600"
                  : isLight ? "bg-gray-300" : "bg-gray-600"
              )}></span>
              <span className={cn(
                "absolute left-0 top-0 h-6 w-6 border transition-transform rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600",
                config.isEnabled ? "translate-x-6" : "translate-x-0"
              )}></span>
            </label>
          </div>

          <div className={cn(
            "border p-6 flex items-center justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4 rounded-lg">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                config.apiKeyEnabled
                  ? isLight ? "bg-blue-500" : "bg-blue-600"
                  : isLight ? "bg-gray-400" : "bg-gray-600"
              )}>
                <Key className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h3 className={cn(
                  "font-semibold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminConfig.apiKeyAuth}
                </h3>
                <p className={cn(
                  "text-sm rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminConfig.enableApiKey}
                </p>
              </div>
            </div>
            <label className="relative inline-block w-12 h-6 cursor-pointer rounded-lg">
              <input
                type="checkbox"
                name="toggle"
                id="toggle-key"
                checked={config.apiKeyEnabled}
                onChange={(e) => setConfig({ ...config, apiKeyEnabled: e.target.checked })}
                className="sr-only"
              />
              <span className={cn(
                "absolute inset-0 transition-colors rounded-lg",
                config.apiKeyEnabled
                  ? isLight ? "bg-blue-500" : "bg-blue-600"
                  : isLight ? "bg-gray-300" : "bg-gray-600"
              )}></span>
              <span className={cn(
                "absolute left-0 top-0 h-6 w-6 border transition-transform rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600",
                config.apiKeyEnabled ? "translate-x-6" : "translate-x-0"
              )}></span>
            </label>
          </div>

          <div className={cn(
            "border p-6 flex items-center justify-between rounded-lg",
            isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
          )}>
            <div className="flex items-center gap-4 rounded-lg">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg",
                config.enableDirectResponse
                  ? isLight ? "bg-purple-500" : "bg-purple-600"
                  : isLight ? "bg-gray-400" : "bg-gray-600"
              )}>
                <ExternalLink className="w-6 h-6 text-white rounded-lg" />
              </div>
              <div>
                <h3 className={cn(
                  "font-semibold rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminConfig.enableDirectResponse}
                </h3>
                <p className={cn(
                  "text-sm rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  Allow non-redirect
                </p>
              </div>
            </div>
            <label className="relative inline-block w-12 h-6 cursor-pointer rounded-lg">
              <input
                type="checkbox"
                name="toggle"
                id="toggle-direct"
                checked={config.enableDirectResponse}
                onChange={(e) => setConfig({ ...config, enableDirectResponse: e.target.checked })}
                className="sr-only"
              />
              <span className={cn(
                "absolute inset-0 transition-colors rounded-lg",
                config.enableDirectResponse
                  ? isLight ? "bg-purple-500" : "bg-purple-600"
                  : isLight ? "bg-gray-300" : "bg-gray-600"
              )}></span>
              <span className={cn(
                "absolute left-0 top-0 h-6 w-6 border transition-transform rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600",
                config.enableDirectResponse ? "translate-x-6" : "translate-x-0"
              )}></span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 rounded-lg">
          {/* Left Column: Settings */}
          <div className="lg:col-span-2 space-y-6 rounded-lg">
            {/* API Key Config */}
            {config.apiKeyEnabled && (
              <div className={cn(
                "border p-6 space-y-4 rounded-lg",
                isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
              )}>
                <div className="flex items-center gap-3 mb-4 rounded-lg">
                  <Shield className={cn(
                    "w-5 h-5 rounded-lg",
                    isLight ? "text-blue-500" : "text-blue-400"
                  )} />
                  <h3 className={cn(
                    "font-bold text-lg rounded-lg",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminConfig.apiKeyValue}
                  </h3>
                </div>
                <div className="flex gap-3 rounded-lg">
                  <input
                    type="text"
                    value={config.apiKey || ''}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    placeholder={t.adminConfig.apiKeyPlaceholder}
                    className={cn(
                      "flex-1 p-3 border outline-none focus:border-blue-500 font-mono rounded-lg",
                      isLight
                        ? "bg-white border-gray-300"
                        : "bg-gray-800 border-gray-600"
                    )}
                  />
                  <button
                    onClick={() => {
                      const randomKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                      setConfig({ ...config, apiKey: randomKey });
                    }}
                    className={cn(
                      "px-4 py-2 border transition-colors rounded-lg",
                      isLight
                        ? "bg-gray-100 border-gray-300 hover:bg-gray-200"
                        : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                    )}
                  >
                    {t.adminConfig.generateKey}
                  </button>
                </div>
                <p className={cn(
                  "text-sm rounded-lg",
                  isLight ? "text-gray-600" : "text-gray-400"
                )}>
                  {t.adminConfig.apiKeyValueDesc}
                </p>
              </div>
            )}

            {/* Scope Config */}
            <div className={cn(
              "border p-6 space-y-6 rounded-lg",
              isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
            )}>
              <div className="flex items-center gap-3 mb-4 rounded-lg">
                <Database className={cn(
                  "w-5 h-5 rounded-lg",
                  isLight ? "text-blue-500" : "text-blue-400"
                )} />
                <h3 className={cn(
                  "font-bold text-lg rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminConfig.defaultScope}
                </h3>
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2 rounded-lg",
                  isLight ? "text-gray-700" : "text-gray-300"
                )}>
                  {t.adminConfig.defaultScopeDesc}
                </label>
                <select
                  value={config.defaultScope}
                  onChange={(e) => setConfig({ ...config, defaultScope: e.target.value as 'all' | 'groups' })}
                  className={cn(
                    "w-full p-3 border outline-none focus:border-blue-500 rounded-lg",
                    isLight
                      ? "bg-white border-gray-300"
                      : "bg-gray-800 border-gray-600"
                  )}
                >
                  <option value="all">{t.adminConfig.scopeAll}</option>
                  <option value="groups">{t.adminConfig.scopeGroups}</option>
                </select>
              </div>

              {config.defaultScope === 'groups' && (
                <div className={cn(
                  "p-4 border rounded-lg",
                  isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
                )}>
                  <label className={cn(
                    "block text-sm font-medium mb-3 rounded-lg",
                    isLight ? "text-gray-700" : "text-gray-300"
                  )}>
                    {t.adminConfig.defaultGroups}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {groups.map((group) => (
                      <label
                        key={group.id}
                        className={cn(
                          "flex items-center gap-2 p-2 border cursor-pointer transition-colors rounded-lg",
                          isLight
                            ? "bg-white border-gray-300 hover:bg-gray-50"
                            : "bg-gray-800 border-gray-600 hover:bg-gray-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={config.defaultGroups.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfig({ ...config, defaultGroups: [...config.defaultGroups, group.id] });
                            } else {
                              setConfig({ ...config, defaultGroups: config.defaultGroups.filter((id) => id !== group.id) });
                            }
                          }}
                          className={cn(
                            "border rounded-lg",
                            isLight
                              ? "border-gray-300"
                              : "border-gray-600"
                          )}
                        />
                        <span className={cn(
                          "text-sm rounded-lg",
                          isLight ? "text-gray-900" : "text-gray-100"
                        )}>
                          {group.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Parameter Management */}
            <div className={cn(
              "border p-6 rounded-lg",
              isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
            )}>
              <div className="flex items-center justify-between mb-6 rounded-lg">
                <div className="flex items-center gap-3">
                  <Settings className={cn(
                    "w-5 h-5 rounded-lg",
                    isLight ? "text-blue-500" : "text-blue-400"
                  )} />
                  <h3 className={cn(
                    "font-bold text-lg rounded-lg",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminConfig.parameterManagement}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddParameter(true)}
                  className={cn(
                    "px-3 py-1.5 text-sm border flex items-center gap-2 transition-colors rounded-lg",
                    isLight
                      ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                      : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                  )}
                >
                  <Plus className="w-4 h-4" />
                  {t.adminConfig.addParameter}
                </button>
              </div>

              <div className="space-y-4">
                {config.allowedParameters.length === 0 ? (
                  <div className={cn(
                    "text-center py-12 border-2 border-dashed rounded-lg",
                    isLight
                      ? "border-gray-300 text-gray-600"
                      : "border-gray-600 text-gray-400"
                  )}>
                    <p>{t.adminConfig.noParameters}</p>
                    <button
                      onClick={() => setShowAddParameter(true)}
                      className={cn(
                        "mt-4 px-4 py-2 border transition-colors rounded-lg",
                        isLight
                          ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                          : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                      )}
                    >
                      {t.adminConfig.addFirstParameter}
                    </button>
                  </div>
                ) : (
                  config.allowedParameters.map((param, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 border flex items-center justify-between group transition-colors rounded-lg",
                        isLight
                          ? "bg-gray-50 border-gray-300 hover:bg-gray-100"
                          : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className={cn(
                            "font-bold rounded-lg",
                            isLight ? "text-gray-900" : "text-gray-100"
                          )}>
                            {param.name}
                          </h4>
                          <span className={cn(
                            "text-xs px-2 py-0.5 border rounded-lg",
                            param.isEnabled
                              ? isLight
                                ? "bg-green-50 border-green-300 text-green-700"
                                : "bg-green-900/20 border-green-600 text-green-400"
                              : isLight
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-red-900/20 border-red-600 text-red-400"
                          )}>
                            {param.isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 border capitalize rounded-lg",
                            isLight
                              ? "bg-blue-50 border-blue-300 text-blue-700"
                              : "bg-blue-900/20 border-blue-600 text-blue-400"
                          )}>
                            {param.type}
                          </span>
                        </div>
                        <div className={cn(
                          "text-xs rounded-lg",
                          isLight ? "text-gray-600" : "text-gray-400"
                        )}>
                          Values: {param.allowedValues.join(', ')}
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingParameter(param)}
                          className={cn(
                            "p-2 border transition-colors rounded-lg",
                            isLight
                              ? "text-blue-600 border-gray-300 hover:bg-blue-50"
                              : "text-blue-400 border-gray-600 hover:bg-blue-900/20"
                          )}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteParameter(index)}
                          className={cn(
                            "p-2 border transition-colors rounded-lg",
                            isLight
                              ? "text-red-600 border-gray-300 hover:bg-red-50"
                              : "text-red-400 border-gray-600 hover:bg-red-900/20"
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: API Test & Info */}
          <div className="space-y-6 rounded-lg">
            <div className={cn(
              "border p-6 space-y-6 sticky top-24 rounded-lg",
              isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
            )}>
              <h3 className={cn(
                "font-bold text-lg mb-4 rounded-lg",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {t.adminConfig.apiLinks}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className={cn(
                    "text-xs uppercase tracking-wider mb-1 block rounded-lg",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    Base URL
                  </label>
                  <div className="flex gap-2 rounded-lg">
                    <div className={cn(
                      "flex-1 p-2 border font-mono text-xs truncate rounded-lg",
                      isLight
                        ? "bg-gray-50 border-gray-300"
                        : "bg-gray-700 border-gray-600"
                    )}>
                      {generateApiUrl()}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(generateApiUrl())}
                      className={cn(
                        "p-2 border transition-colors rounded-lg",
                        isLight
                          ? "bg-gray-100 border-gray-300 hover:bg-gray-200"
                          : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                      )}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "text-xs uppercase tracking-wider mb-2 block rounded-lg",
                    isLight ? "text-gray-600" : "text-gray-400"
                  )}>
                    Examples
                  </label>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 rounded-lg">
                    {generateExampleUrls().map((example, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 border text-xs rounded-lg",
                          isLight
                            ? "bg-gray-50 border-gray-300"
                            : "bg-gray-700 border-gray-600"
                        )}
                      >
                        <div className={cn(
                          "font-semibold mb-1 truncate rounded-lg",
                          isLight ? "text-gray-900" : "text-gray-100"
                        )} title={example.label}>
                          {example.label}
                        </div>
                        <div className="flex gap-2 items-center rounded-lg">
                          <div className={cn(
                            "flex-1 font-mono truncate rounded-lg",
                            isLight ? "text-gray-600" : "text-gray-400"
                          )} title={example.url}>
                            {example.url}
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(example.url)}
                            className={cn(
                              "hover:opacity-70 transition-opacity rounded-lg",
                              isLight ? "text-gray-700" : "text-gray-300"
                            )}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => window.open(example.url, '_blank')}
                            className={cn(
                              "hover:opacity-70 transition-opacity rounded-lg",
                              isLight ? "text-gray-700" : "text-gray-300"
                            )}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={cn(
                "pt-6 border-t rounded-lg",
                isLight ? "border-gray-300" : "border-gray-600"
              )}>
                <h3 className={cn(
                  "font-bold text-lg mb-4 rounded-lg",
                  isLight ? "text-gray-900" : "text-gray-100"
                )}>
                  {t.adminConfig.apiTest}
                </h3>
                <div className="flex gap-2 mb-4 rounded-lg">
                  <input
                    type="text"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://..."
                    className={cn(
                      "flex-1 p-2 border outline-none focus:border-blue-500 text-sm font-mono rounded-lg",
                      isLight
                        ? "bg-white border-gray-300"
                        : "bg-gray-800 border-gray-600"
                    )}
                  />
                  <button
                    onClick={testApi}
                    disabled={!testUrl || testing}
                    className={cn(
                      "px-3 py-2 border flex items-center transition-colors disabled:opacity-50 rounded-lg",
                      isLight
                        ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                    )}
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>

                {testResult && (
                  <div className={cn(
                    "p-4 border text-xs font-mono overflow-hidden rounded-lg",
                    testResult.success
                      ? isLight
                        ? "bg-green-50 border-green-300"
                        : "bg-green-900/20 border-green-600"
                      : isLight
                      ? "bg-red-50 border-red-300"
                      : "bg-red-900/20 border-red-600"
                  )}>
                    <div className={cn(
                      "flex items-center gap-2 mb-2 font-bold rounded-lg",
                      testResult.success
                        ? isLight ? "text-green-700" : "text-green-400"
                        : isLight ? "text-red-700" : "text-red-400"
                    )}>
                      {testResult.success ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      <span>{testResult.status} {testResult.statusText}</span>
                    </div>
                    {testResult.error && (
                      <div className={isLight ? "text-red-600" : "text-red-400"}>
                        {testResult.error}
                      </div>
                    )}
                    {testResult.headers && (
                      <div className={cn(
                        "opacity-70 mt-2 rounded-lg",
                        isLight ? "text-gray-600" : "text-gray-400"
                      )}>
                        <div className="uppercase text-[10px] mb-1">Response Headers:</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg">
                          {JSON.stringify(testResult.headers, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <ParameterModal
          parameter={editingParameter}
          groups={groups}
          isOpen={showAddParameter || editingParameter !== null}
          onClose={() => {
            setShowAddParameter(false);
            setEditingParameter(null);
          }}
          onSave={(parameter) => {
            if (editingParameter) {
              const index = config.allowedParameters.findIndex((p) => p.name === editingParameter.name);
              if (index !== -1) updateParameter(index, parameter);
            } else {
              addParameter(parameter);
            }
          }}
          isEditing={editingParameter !== null}
        />

        <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
      </div>
    );
}
          