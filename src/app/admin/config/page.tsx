'use client'

import { useState, useEffect, useCallback } from 'react'
import ParameterModal from '@/components/admin/ParameterModal'
import { useLocale } from '@/hooks/useLocale'

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
  const [config, setConfig] = useState<APIConfig | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingParameter, setEditingParameter] = useState<APIParameter | null>(null)
  const [showAddParameter, setShowAddParameter] = useState(false)
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

  const getDefaultConfig = (): APIConfig => ({
    id: 'default',
    isEnabled: true,
    defaultScope: 'all',
    defaultGroups: [],
    allowedParameters: [],
    enableDirectResponse: false,
    updatedAt: new Date().toISOString()
  })

  const loadConfig = useCallback(async () => {
    console.log('开始加载配置...')
    try {
      const response = await fetch('/api/admin/config', {
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })
      console.log('配置加载响应:', response.status, response.statusText)
      if (response.ok) {
        const data = await response.json()
        console.log('配置加载成功:', data.data?.config)
        const loadedConfig = data.data?.config || getDefaultConfig()
        // 确保 enableDirectResponse 字段存在
        if (loadedConfig.enableDirectResponse === undefined) {
          loadedConfig.enableDirectResponse = false
        }
        setConfig(loadedConfig)
      } else {
        console.error('加载配置失败:', {
          status: response.status,
          statusText: response.statusText
        })
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
      const response = await fetch('/api/admin/groups', {
        headers: {
          'X-Admin-Password': 'admin123'
        }
      })
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
      console.error('配置为空，无法保存')
      alert(t.adminConfig.saveFailed)
      return
    }

    // 验证配置数据
    if (!config.defaultScope || !['all', 'groups'].includes(config.defaultScope)) {
      alert(t.adminConfig.invalidDefaultScope)
      return
    }

    // 验证参数配置
    for (const param of config.allowedParameters) {
      if (!param.name || param.name.trim() === '') {
        alert(t.adminConfig.invalidParameterName)
        return
      }
      if (!param.type || !['group', 'custom'].includes(param.type)) {
        alert(t.adminConfig.invalidParameterType)
        return
      }
      if (!param.allowedValues || param.allowedValues.length === 0) {
        alert(t.adminConfig.invalidAllowedValues)
        return
      }
      if (!param.mappedGroups || !Array.isArray(param.mappedGroups)) {
        alert(t.adminConfig.invalidMappedGroups)
        return
      }
    }

    const requestData = {
      isEnabled: config.isEnabled,
      defaultScope: config.defaultScope,
      defaultGroups: config.defaultGroups,
      allowedParameters: config.allowedParameters,
      enableDirectResponse: config.enableDirectResponse
    }
    console.log('开始保存配置...', config)
    console.log('发送的请求数据:', requestData)
    console.log('allowedParameters详情:', JSON.stringify(requestData.allowedParameters, null, 2))
    setSaving(true)
    try {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': 'admin123'
        },
        body: JSON.stringify(requestData)
      })

      console.log('请求发送完成，状态:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        alert(data.message || t.adminConfig.saveSuccess)
        await loadConfig()
      } else {
        const errorData = await response.json()
        console.error('API配置更新失败:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        })
        alert(errorData.error?.message || `${t.adminConfig.saveFailed} (${response.status}: ${response.statusText})`)
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      alert(`${t.adminConfig.saveFailed}: ${error instanceof Error ? error.message : '网络错误'}`)
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
      <div className="space-y-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <div className="transparent-panel rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-bold panel-text mb-4">{t.adminConfig.title}</h1>
          <p className="text-red-600 dark:text-red-400">
            {t.adminConfig.loadFailed}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和API状态 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold panel-text mb-2">{t.adminConfig.title}</h1>
            <p className="text-gray-600 dark:text-gray-300 panel-text">
              {t.adminConfig.description}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${config.isEnabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {config.isEnabled ? 'ON' : 'OFF'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
              {t.adminConfig.apiStatus}
            </div>
          </div>
        </div>

        {/* API基本设置 */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.isEnabled}
                  onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm font-medium panel-text">{t.adminConfig.enablePublicAPI}</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.adminConfig.enablePublicAPIDesc}
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.enableDirectResponse}
                  onChange={(e) => setConfig({ ...config, enableDirectResponse: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm font-medium panel-text">{t.adminConfig.enableDirectResponse}</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.adminConfig.enableDirectResponseDesc}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium panel-text mb-2">
                {t.adminConfig.defaultScope}
              </label>
              <select
                value={config.defaultScope}
                onChange={(e) => setConfig({ ...config, defaultScope: e.target.value as 'all' | 'groups' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
              >
                <option value="all">{t.adminConfig.scopeAll}</option>
                <option value="groups">{t.adminConfig.scopeGroups}</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.adminConfig.defaultScopeDesc}
              </p>
            </div>
          </div>

          {config.defaultScope === 'groups' && (
            <div className="mt-4">
              <label className="block text-sm font-medium panel-text mb-2">
                {t.adminConfig.defaultGroups}
              </label>
              <div className="flex flex-wrap gap-2">
                {groups.map(group => (
                  <label key={group.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.defaultGroups.includes(group.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig({
                            ...config,
                            defaultGroups: [...config.defaultGroups, group.id]
                          })
                        } else {
                          setConfig({
                            ...config,
                            defaultGroups: config.defaultGroups.filter(id => id !== group.id)
                          })
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-2 text-sm panel-text">{group.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API参数管理 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold panel-text">{t.adminConfig.parameterManagement}</h2>
          <button
            onClick={() => setShowAddParameter(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t.adminConfig.addParameter}
          </button>
        </div>

        {/* 参数列表 */}
        {config.allowedParameters.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium panel-text mb-2">{t.adminConfig.noParameters}</h3>
            <p className="text-gray-500 dark:text-gray-400 panel-text mb-4">
              {t.adminConfig.addParameterDesc}
            </p>
            <button
              onClick={() => setShowAddParameter(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {t.adminConfig.addFirstParameter}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {config.allowedParameters.map((param, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-medium panel-text mr-3">{param.name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        param.isEnabled
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {param.isEnabled ? t.adminConfig.enabled : t.adminConfig.disabled}
                      </span>
                      <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        param.type === 'group'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                      }`}>
                        {param.type === 'group' ? t.adminConfig.groupParameter : t.adminConfig.customParameter}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-300 panel-text mb-2">
                      <strong>{t.adminConfig.allowedValues}:</strong> {param.allowedValues.join(', ') || t.adminConfig.none}
                    </div>

                    {param.type === 'group' && param.mappedGroups.length > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-300 panel-text">
                        <strong>{t.adminConfig.mappedGroups}:</strong> {param.mappedGroups.map(groupId => {
                          const group = groups.find(g => g.id === groupId)
                          return group?.name || groupId
                        }).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => setEditingParameter(param)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                      title={t.adminConfig.editParameter}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteParameter(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                      title={t.adminConfig.deleteParameter}
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

      {/* API链接和示例 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-lg font-semibold panel-text mb-4">{t.adminConfig.apiLinks}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              {t.adminConfig.baseApiUrl}
            </label>
            <div className="flex">
              <input
                type="text"
                value={generateApiUrl()}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-700 panel-text"
              />
              <button
                onClick={() => navigator.clipboard.writeText(generateApiUrl())}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors"
                title={t.adminConfig.copyLink}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              {t.adminConfig.exampleUrls}
            </label>
            <div className="space-y-3">
              {generateExampleUrls().map((example, index) => (
                <div key={index} className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    {example.label}
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={example.url}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-700 panel-text text-sm"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(example.url)}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                      title={t.adminConfig.copyLink}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => window.open(example.url, '_blank')}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-r-lg transition-colors"
                      title={t.adminConfig.openInNewTab}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* API测试 */}
      <div className="transparent-panel rounded-lg p-6 shadow-lg">
        <h2 className="text-lg font-semibold panel-text mb-4">{t.adminConfig.apiTest}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium panel-text mb-2">
              {t.adminConfig.testUrl}
            </label>
            <div className="flex">
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder={t.adminConfig.testUrlPlaceholder}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
              />
              <button
                onClick={testApi}
                disabled={!testUrl || testing}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-r-lg transition-colors"
              >
                {testing ? t.adminConfig.testing : t.adminConfig.test}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'}`}>
              <h3 className={`font-medium mb-2 ${testResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {t.adminConfig.testResult}
              </h3>
              <div className="text-sm space-y-1">
                {testResult.status && (
                  <div>
                    <strong>{t.adminConfig.status}:</strong> {testResult.status} {testResult.statusText}
                  </div>
                )}
                {testResult.error && (
                  <div className="text-red-600 dark:text-red-400">
                    <strong>{t.adminConfig.error}:</strong> {testResult.error}
                  </div>
                )}
                {testResult.headers && (
                  <div>
                    <strong>{t.adminConfig.headers}:</strong>
                    <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {JSON.stringify(testResult.headers, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {saving ? t.adminConfig.saving : t.adminConfig.saveConfig}
        </button>
      </div>

      {/* 参数编辑/添加模态框 */}
      <ParameterModal
        parameter={editingParameter}
        groups={groups}
        isOpen={showAddParameter || editingParameter !== null}
        onClose={() => {
          setShowAddParameter(false)
          setEditingParameter(null)
        }}
        onSave={(parameter) => {
          if (editingParameter) {
            const index = config.allowedParameters.findIndex(p => p.name === editingParameter.name)
            if (index !== -1) {
              updateParameter(index, parameter)
            }
          } else {
            addParameter(parameter)
          }
        }}
        isEditing={editingParameter !== null}
      />
    </div>
  )
}