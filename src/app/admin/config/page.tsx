'use client'

import { useState, useEffect, useCallback } from 'react'
import ParameterModal from '@/components/admin/ParameterModal'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import {
  createDefaultResponseParamsConfig,
  normalizeResponseParamsConfig
} from '@/lib/response-params'
import {
  createDefaultSelectionParamsConfig,
  normalizeSelectionParamsConfig
} from '@/lib/selection-params'
import { useAdminApi } from '@/lib/admin-api-client'
import pageStyles from '../admin-pages.module.css'

interface APIParameter {
  name: string
  type: 'group' | 'custom' | 'provider'
  allowedValues: string[]
  mappedGroups: string[]
  mappedProviders?: string[]
  isEnabled: boolean
}

interface APIConfig {
  id: string
  isEnabled: boolean
  defaultScope: 'all' | 'groups'
  defaultGroups: string[]
  allowedParameters: APIParameter[]
  responseParams: {
    format: {
      enabled: boolean
      allowedValues: Array<'jpeg' | 'webp'>
    }
    quality: {
      enabled: boolean
    }
    defaultWebpDelivery: {
      random: boolean
      response: boolean
    }
  }
  selectionParams: {
    timeWeighting: {
      enabled: boolean
    }
  }
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
  const { adminFetch, selectedNode } = useAdminApi();
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
    mappedProviders: [],
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
    responseParams: createDefaultResponseParamsConfig(),
    selectionParams: createDefaultSelectionParamsConfig(),
    enableDirectResponse: false,
    apiKeyEnabled: false,
    apiKey: '',
    updatedAt: new Date().toISOString()
  })

  const loadConfig = useCallback(async () => {
    try {
      const response = await adminFetch('/api/admin/config')
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
        loadedConfig.responseParams = normalizeResponseParamsConfig(loadedConfig.responseParams)
        loadedConfig.selectionParams = normalizeSelectionParamsConfig(loadedConfig.selectionParams)
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
  }, [adminFetch])

  const loadGroups = useCallback(async () => {
    try {
      const response = await adminFetch('/api/admin/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.data?.groups || [])
      }
    } catch (error) {
      console.error('加载分组失败:', error)
    }
  }, [adminFetch])

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
      if (!param.type || !['group', 'custom', 'provider'].includes(param.type)) {
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
      if (param.type === 'provider') {
        if (!param.mappedProviders || !Array.isArray(param.mappedProviders) || param.mappedProviders.length === 0) {
          showWarning(t.adminConfig.validationFailedSelectProvider)
          return
        }
      }
    }

    if (config.responseParams.format.enabled && config.responseParams.format.allowedValues.length === 0) {
      showWarning(t.adminConfig.invalidResponseFormats)
      return
    }

    const requestData = {
      isEnabled: config.isEnabled,
      defaultScope: config.defaultScope,
      defaultGroups: config.defaultGroups,
      allowedParameters: config.allowedParameters,
      responseParams: config.responseParams,
      selectionParams: config.selectionParams,
      enableDirectResponse: config.enableDirectResponse,
      apiKeyEnabled: config.apiKeyEnabled,
      apiKey: config.apiKey
    }

    setSaving(true)
    try {
      const response = await adminFetch('/api/admin/config', {
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
      showError(`${t.adminConfig.saveFailed}: ${error instanceof Error ? error.message : t.adminLogin.networkError}`)
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
      mappedProviders: [],
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
    const baseUrl = selectedNode.baseUrl
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

    if (config.responseParams.format.enabled) {
      const exampleFormat = config.responseParams.format.allowedValues[0]
      if (exampleFormat) {
        examples.push({
          label: `${t.adminConfig.exampleManagedFormat} (${exampleFormat})`,
          url: `${randomBaseUrl}?format=${exampleFormat === 'jpeg' ? 'jpg' : exampleFormat}`
        })
      }
    }

    if (config.responseParams.quality.enabled) {
      examples.push({
        label: `${t.adminConfig.exampleManagedQuality} (quality=0.8)`,
        url: `${randomBaseUrl}?quality=0.8`
      })
    }

    if (config.selectionParams.timeWeighting.enabled) {
      examples.push({
        label: `${t.adminConfig.exampleTimeWeighting} (timeWindow=7d, timeWeight=3)`,
        url: `${randomBaseUrl}?timeWindow=7d&timeWeight=3`
      })
      if (config.enableDirectResponse) {
        examples.push({
          label: `${t.adminConfig.exampleResponseTimeWeighting} (timeWindow=7d, timeWeight=3)`,
          url: `${responseBaseUrl}?timeWindow=7d&timeWeight=3`
        })
      }
    }

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
        error: error instanceof Error ? error.message : t.adminConfig.testFailed,
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
        pageStyles.surface
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
        pageStyles.surface
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
      <div className={cn(pageStyles.page, "admin-config-page pb-20")}>
        <header className={pageStyles.hero}>
          <div>
            <h1 className={pageStyles.heroTitle}>
              <span>{t.adminNav.apiConfig}</span>
              <span className="admin-config-illustration admin-config-illustration-hero" aria-hidden="true" />
            </h1>
            <p className={pageStyles.heroSubtitle}>{t.adminConfig.description}</p>
          </div>
          <div className={pageStyles.heroActions}>
            <button
              type="button"
              onClick={() => { loadConfig(); loadGroups(); }}
              className={cn(pageStyles.btn, pageStyles.btnLavender)}
            >
              <span className="admin-config-action admin-config-action-refresh" aria-hidden="true" />
              {t.common.refresh}
            </button>
            <button
              type="button"
              onClick={saveConfig}
              disabled={saving}
              className={cn(pageStyles.btn, pageStyles.btnPink)}
            >
              <span className="admin-config-action admin-config-action-save" aria-hidden="true" />
              {saving ? t.adminConfig.saving : t.common.save}
            </button>
          </div>
        </header>

        <section className="admin-config-reference" aria-label={t.adminUi.currentConfig}>
          <article className="admin-config-current">
            <h2>{t.adminUi.currentConfig}</h2>
            <label>
              <span>{t.adminConfig.apiStatus}</span>
              <span className="admin-config-switch">
                <input type="checkbox" checked={config.isEnabled} onChange={(event) => setConfig({ ...config, isEnabled: event.target.checked })} />
                <i />
                <b>{config.isEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
              </span>
            </label>
            <label>
              <span>{t.adminConfig.apiKeyAuth}</span>
              <span className="admin-config-switch">
                <input type="checkbox" checked={config.apiKeyEnabled} onChange={(event) => setConfig({ ...config, apiKeyEnabled: event.target.checked })} />
                <i />
                <b>{config.apiKeyEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
              </span>
            </label>
            <label>
              <span>{t.adminConfig.apiKeyValue}</span>
              <input
                type="text"
                value={config.apiKey || ''}
                onChange={(event) => setConfig({ ...config, apiKey: event.target.value })}
                placeholder={config.apiKeyEnabled ? t.adminConfig.apiKeyPlaceholder : t.adminStatus.notConfigured}
                disabled={!config.apiKeyEnabled}
              />
            </label>
            <label>
              <span>{t.adminConfig.defaultScope}</span>
              <select value={config.defaultScope} onChange={(event) => setConfig({ ...config, defaultScope: event.target.value as 'all' | 'groups' })}>
                <option value="all">{t.adminConfig.scopeAll}</option>
                <option value="groups">{t.adminConfig.scopeGroups}</option>
              </select>
            </label>
            {config.defaultScope === 'groups' && (
              <label className="admin-config-groups">
                <span>{t.adminConfig.defaultGroups}</span>
                <div className="admin-config-group-list">
                  {groups.length === 0 ? (
                    <output>{t.adminConfig.none}</output>
                  ) : (
                    groups.map((group) => (
                      <label key={group.id}>
                        <input
                          type="checkbox"
                          checked={config.defaultGroups.includes(group.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setConfig({ ...config, defaultGroups: [...config.defaultGroups, group.id] })
                            } else {
                              setConfig({
                                ...config,
                                defaultGroups: config.defaultGroups.filter((id) => id !== group.id)
                              })
                            }
                          }}
                        />
                        <b>{group.name}</b>
                      </label>
                    ))
                  )}
                </div>
              </label>
            )}
            <label>
              <span>{t.adminUi.responseMode}</span>
              <span className="admin-config-switch">
                <input type="checkbox" checked={config.enableDirectResponse} onChange={(event) => setConfig({ ...config, enableDirectResponse: event.target.checked })} />
                <i />
                <b>{config.enableDirectResponse ? t.adminUi.directResponse : t.adminUi.redirectResponse}</b>
              </span>
            </label>
            <label>
              <span>{t.adminConfig.formatParamTitle}</span>
              <span className="admin-config-switch">
                <input
                  type="checkbox"
                  checked={config.responseParams.format.enabled}
                  onChange={(event) => setConfig({
                    ...config,
                    responseParams: {
                      ...config.responseParams,
                      format: {
                        ...config.responseParams.format,
                        enabled: event.target.checked
                      }
                    }
                  })}
                />
                <i />
                <b>{config.responseParams.format.enabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
              </span>
            </label>
            <label className="admin-config-formats">
              <span>{t.adminUi.defaultFormats}</span>
              <div className="admin-config-format-list">
                {(['jpeg', 'webp'] as const).map((format) => (
                  <label key={format}>
                    <input
                      type="checkbox"
                      checked={config.responseParams.format.allowedValues.includes(format)}
                      onChange={(event) => {
                        const nextValues = event.target.checked
                          ? [...config.responseParams.format.allowedValues, format]
                          : config.responseParams.format.allowedValues.filter((item) => item !== format)

                        setConfig({
                          ...config,
                          responseParams: {
                            ...config.responseParams,
                            format: {
                              ...config.responseParams.format,
                              allowedValues: [...new Set(nextValues)]
                            }
                          }
                        })
                      }}
                    />
                    <b>{format === 'jpeg' ? t.adminConfig.formatOptionJpeg : t.adminConfig.formatOptionWebp}</b>
                  </label>
                ))}
              </div>
            </label>
          </article>
        </section>

        <div className="admin-config-advanced">
          <div className="admin-config-advanced-main">
            <article className="admin-config-panel">
              <h2>{t.adminConfig.apiStatus}</h2>
              <p className="admin-config-panel-desc">{t.adminConfig.enablePublicAPI}</p>
              <div className="admin-config-toggle-grid">
                <label>
                  <span>
                    <span className="admin-config-illustration admin-config-illustration-shield" aria-hidden="true" />
                    <b>{t.adminConfig.apiStatus}</b>
                    <small>{t.adminConfig.enablePublicAPI}</small>
                  </span>
                  <span className="admin-config-switch">
                    <input
                      type="checkbox"
                      checked={config.isEnabled}
                      onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                    />
                    <i />
                    <b>{config.isEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
                  </span>
                </label>
                <label>
                  <span>
                    <span className="admin-config-illustration admin-config-illustration-lock" aria-hidden="true" />
                    <b>{t.adminConfig.apiKeyAuth}</b>
                    <small>{t.adminConfig.enableApiKey}</small>
                  </span>
                  <span className="admin-config-switch">
                    <input
                      type="checkbox"
                      checked={config.apiKeyEnabled}
                      onChange={(e) => setConfig({ ...config, apiKeyEnabled: e.target.checked })}
                    />
                    <i />
                    <b>{config.apiKeyEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
                  </span>
                </label>
                <label>
                  <span>
                    <span className="admin-config-illustration admin-config-illustration-notebook" aria-hidden="true" />
                    <b>{t.adminConfig.enableDirectResponse}</b>
                    <small>{t.adminConfig.enableDirectResponseDesc}</small>
                  </span>
                  <span className="admin-config-switch">
                    <input
                      type="checkbox"
                      checked={config.enableDirectResponse}
                      onChange={(e) => setConfig({ ...config, enableDirectResponse: e.target.checked })}
                    />
                    <i />
                    <b>{config.enableDirectResponse ? t.adminUi.directResponse : t.adminUi.redirectResponse}</b>
                  </span>
                </label>
              </div>
            </article>

            {config.apiKeyEnabled && (
              <article className="admin-config-panel">
                <h2>{t.adminConfig.apiKeyValue}</h2>
                <p className="admin-config-panel-desc">{t.adminConfig.apiKeyValueDesc}</p>
                <label className="admin-config-inline-field">
                  <span><span className="admin-config-illustration admin-config-illustration-shield" aria-hidden="true" /> {t.adminConfig.apiKeyValue}</span>
                  <div className="admin-config-inline-controls">
                    <input
                      type="text"
                      value={config.apiKey || ''}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder={t.adminConfig.apiKeyPlaceholder}
                    />
                    <button
                      type="button"
                      className={cn(pageStyles.btn, pageStyles.btnLavender)}
                      onClick={() => {
                        const randomKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                        setConfig({ ...config, apiKey: randomKey })
                      }}
                    >
                      {t.adminConfig.generateKey}
                    </button>
                  </div>
                </label>
              </article>
            )}

            <article className="admin-config-panel">
              <h2>{t.adminConfig.responseParamsTitle}</h2>
              <p className="admin-config-panel-desc">{t.adminConfig.responseParamsDesc}</p>
              <label>
                <span>{t.adminConfig.formatParamTitle}</span>
                <span className="admin-config-switch">
                  <input
                    type="checkbox"
                    checked={config.responseParams.format.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      responseParams: {
                        ...config.responseParams,
                        format: { ...config.responseParams.format, enabled: e.target.checked }
                      }
                    })}
                  />
                  <i />
                  <b>{config.responseParams.format.enabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
                </span>
              </label>
              <label className="admin-config-formats">
                <span>{t.adminUi.defaultFormats}</span>
                <div className="admin-config-format-list">
                  {(['jpeg', 'webp'] as const).map((format) => (
                    <label key={format}>
                      <input
                        type="checkbox"
                        checked={config.responseParams.format.allowedValues.includes(format)}
                        onChange={(e) => {
                          const nextValues = e.target.checked
                            ? [...config.responseParams.format.allowedValues, format]
                            : config.responseParams.format.allowedValues.filter((item) => item !== format)
                          setConfig({
                            ...config,
                            responseParams: {
                              ...config.responseParams,
                              format: {
                                ...config.responseParams.format,
                                allowedValues: [...new Set(nextValues)]
                              }
                            }
                          })
                        }}
                      />
                      <b>{format === 'jpeg' ? t.adminConfig.formatOptionJpeg : t.adminConfig.formatOptionWebp}</b>
                    </label>
                  ))}
                </div>
              </label>
              <label>
                <span>{t.adminConfig.qualityParamTitle}</span>
                <span className="admin-config-switch">
                  <input
                    type="checkbox"
                    checked={config.responseParams.quality.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      responseParams: {
                        ...config.responseParams,
                        quality: { enabled: e.target.checked }
                      }
                    })}
                  />
                  <i />
                  <b>{config.responseParams.quality.enabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
                </span>
              </label>
              <p className="admin-config-hint">{t.adminConfig.qualityParamHint}</p>
              <label>
                <span>{t.adminConfig.defaultWebpDeliveryRandomTitle}</span>
                <span className="admin-config-switch">
                  <input
                    type="checkbox"
                    checked={config.responseParams.defaultWebpDelivery.random}
                    onChange={(e) => setConfig({
                      ...config,
                      responseParams: {
                        ...config.responseParams,
                        defaultWebpDelivery: {
                          ...config.responseParams.defaultWebpDelivery,
                          random: e.target.checked
                        }
                      }
                    })}
                  />
                  <i />
                  <b>{config.responseParams.defaultWebpDelivery.random ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
                </span>
              </label>
              <label className={!config.enableDirectResponse ? 'is-disabled' : undefined}>
                <span>{t.adminConfig.defaultWebpDeliveryResponseTitle}</span>
                <span className="admin-config-switch">
                  <input
                    type="checkbox"
                    checked={config.responseParams.defaultWebpDelivery.response}
                    disabled={!config.enableDirectResponse}
                    onChange={(e) => setConfig({
                      ...config,
                      responseParams: {
                        ...config.responseParams,
                        defaultWebpDelivery: {
                          ...config.responseParams.defaultWebpDelivery,
                          response: e.target.checked
                        }
                      }
                    })}
                  />
                  <i />
                  <b>
                    {config.enableDirectResponse
                      ? (config.responseParams.defaultWebpDelivery.response ? t.adminStatus.enabled : t.adminStatus.disabled)
                      : t.adminConfig.defaultWebpDeliveryResponseDisabledDesc}
                  </b>
                </span>
              </label>
            </article>

            <article className="admin-config-panel">
              <h2>{t.adminConfig.selectionParamsTitle}</h2>
              <p className="admin-config-panel-desc">{t.adminConfig.selectionParamsDesc}</p>
              <label>
                <span>{t.adminConfig.timeWeightingParamTitle}</span>
                <span className="admin-config-switch">
                  <input
                    type="checkbox"
                    checked={config.selectionParams.timeWeighting.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      selectionParams: {
                        ...config.selectionParams,
                        timeWeighting: { enabled: e.target.checked }
                      }
                    })}
                  />
                  <i />
                  <b>{config.selectionParams.timeWeighting.enabled ? t.adminStatus.enabled : t.adminStatus.disabled}</b>
                </span>
              </label>
              <p className="admin-config-hint">{t.adminConfig.timeWeightingParamHint}</p>
            </article>

            <article className="admin-config-panel">
              <h2>{t.adminConfig.defaultScope}</h2>
              <p className="admin-config-panel-desc">{t.adminConfig.defaultScopeDesc}</p>
              <label>
                <span>{t.adminConfig.defaultScope}</span>
                <select
                  value={config.defaultScope}
                  onChange={(e) => setConfig({ ...config, defaultScope: e.target.value as 'all' | 'groups' })}
                >
                  <option value="all">{t.adminConfig.scopeAll}</option>
                  <option value="groups">{t.adminConfig.scopeGroups}</option>
                </select>
              </label>
              {config.defaultScope === 'groups' && (
                <label className="admin-config-groups">
                  <span>{t.adminConfig.defaultGroups}</span>
                  <div className="admin-config-group-list">
                    {groups.length === 0 ? (
                      <output>{t.adminConfig.none}</output>
                    ) : (
                      groups.map((group) => (
                        <label key={group.id}>
                          <input
                            type="checkbox"
                            checked={config.defaultGroups.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfig({ ...config, defaultGroups: [...config.defaultGroups, group.id] })
                              } else {
                                setConfig({
                                  ...config,
                                  defaultGroups: config.defaultGroups.filter((id) => id !== group.id)
                                })
                              }
                            }}
                          />
                          <b>{group.name}</b>
                        </label>
                      ))
                    )}
                  </div>
                </label>
              )}
            </article>

            <article className="admin-config-panel admin-config-params">
              <h2>{t.adminConfig.parameterManagement}</h2>
              <div className="admin-config-params-toolbar">
                <p className="admin-config-panel-desc">{t.adminConfig.parameterManagement}</p>
                <button
                  type="button"
                  className={cn(pageStyles.btn, pageStyles.btnPink)}
                  onClick={() => setShowAddParameter(true)}
                >
                  <span className="admin-config-action admin-config-action-add" aria-hidden="true" />
                  {t.adminConfig.addParameter}
                </button>
              </div>
              {config.allowedParameters.length === 0 ? (
                <div className="admin-config-empty">
                  <p>{t.adminConfig.noParameters}</p>
                  <button
                    type="button"
                    className={cn(pageStyles.btn, pageStyles.btnLavender)}
                    onClick={() => setShowAddParameter(true)}
                  >
                    {t.adminConfig.addFirstParameter}
                  </button>
                </div>
              ) : (
                <ul className="admin-config-param-list">
                  {config.allowedParameters.map((param, index) => (
                    <li key={`${param.name}-${index}`}>
                      <div>
                        <strong>{param.name}</strong>
                        <span className={param.isEnabled ? 'is-on' : 'is-off'}>
                          {param.isEnabled ? t.adminStatus.enabled : t.adminStatus.disabled}
                        </span>
                        <span className="is-type">{param.type}</span>
                        <small>{param.allowedValues.join(', ')}</small>
                      </div>
                      <div className="admin-config-param-actions">
                        <button type="button" aria-label={t.common.edit} onClick={() => setEditingParameter(param)}>
                          <span className="admin-config-action admin-config-action-edit" aria-hidden="true" />
                        </button>
                        <button type="button" aria-label={t.common.delete} onClick={() => deleteParameter(index)}>
                          <span className="admin-config-action admin-config-action-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <aside className="admin-config-panel admin-config-aside">
            <h2>{t.adminConfig.apiLinks}</h2>
            <label className="admin-config-inline-field">
              <span>Base URL</span>
              <div className="admin-config-inline-controls">
                <output title={generateApiUrl()}>{generateApiUrl()}</output>
                <button
                  type="button"
                  className={cn(pageStyles.btn, pageStyles.btnGhost)}
                  onClick={() => navigator.clipboard.writeText(generateApiUrl())}
                  aria-label={t.common.copy}
                >
                  <span className="admin-config-action admin-config-action-copy" aria-hidden="true" />
                </button>
              </div>
            </label>
            <div className="admin-config-examples">
              <span>Examples</span>
              <ul>
                {generateExampleUrls().map((example, i) => (
                  <li key={i}>
                    <strong title={example.label}>{example.label}</strong>
                    <div>
                      <code title={example.url}>{example.url}</code>
                      <button type="button" aria-label={t.common.copy} onClick={() => navigator.clipboard.writeText(example.url)}>
                        <span className="admin-config-action admin-config-action-copy" aria-hidden="true" />
                      </button>
                      <button type="button" aria-label="open" onClick={() => window.open(example.url, '_blank')}>
                        <span className="admin-config-action admin-config-action-external" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="admin-config-test">
              <h3>{t.adminConfig.apiTest}</h3>
              <div className="admin-config-inline-controls">
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className={cn(pageStyles.btn, pageStyles.btnPink)}
                  onClick={testApi}
                  disabled={!testUrl || testing}
                  aria-label={t.adminConfig.apiTest}
                >
                  <span className="admin-config-action admin-config-action-play" aria-hidden="true" />
                </button>
              </div>
              {testResult && (
                <div className={cn('admin-config-test-result', testResult.success ? 'is-ok' : 'is-err')}>
                  <p>
                    <span className={cn('admin-config-result-mark', testResult.success ? 'is-ok' : 'is-error')} aria-hidden="true" />
                    <span>{testResult.status} {testResult.statusText}</span>
                  </p>
                  {testResult.error && <p>{testResult.error}</p>}
                  {testResult.headers && (
                    <pre>{JSON.stringify(testResult.headers, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          </aside>
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
          
