'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface APIStatus {
  status: string
  services: {
    database: { healthy: boolean }
    cloudinary: { healthy: boolean }
    api: { enabled: boolean }
  }
  stats: {
    totalImages: number
    totalGroups: number
  }
}

export default function Home() {
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null)
  const [randomImageUrl, setRandomImageUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 加载API状态
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setApiStatus(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    // 生成随机图片URL（带时间戳避免缓存）
    setRandomImageUrl(`/api/random?t=${Date.now()}`)
  }, [])

  const refreshRandomImage = () => {
    setRandomImageUrl(`/api/random?t=${Date.now()}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* 导航栏 */}
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                随机图片API
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                管理面板
              </Link>
              <Link
                href="/api/docs"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                API文档
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 主标题区域 */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            随机图片API服务
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            简单易用的随机图片API，支持参数筛选，完美适配各种应用场景。
            直接通过HTTP请求获取高质量随机图片。
          </p>

          {/* API状态指示器 */}
          {!loading && apiStatus && (
            <div className="inline-flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg">
              <div className={`w-3 h-3 rounded-full ${
                apiStatus.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                API状态: {apiStatus.status === 'healthy' ? '正常' : '部分可用'}
              </span>
            </div>
          )}
        </div>

        {/* 快速体验区域 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            快速体验
          </h2>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                随机图片预览
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <img
                  src={randomImageUrl}
                  alt="随机图片"
                  className="w-full h-64 object-cover rounded-lg"
                  onError={() => setRandomImageUrl('/placeholder-image.jpg')}
                />
              </div>
              <button
                onClick={refreshRandomImage}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                刷新图片
              </button>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                API调用示例
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    基础调用
                  </label>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                    <code className="text-sm text-gray-800 dark:text-gray-200">
                      GET /api/random
                    </code>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    HTML中使用
                  </label>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                    <code className="text-sm text-gray-800 dark:text-gray-200">
                      {`<img src="/api/random" />`}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 功能特性 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              高性能
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              基于Cloudinary CDN，全球加速，毫秒级响应，支持高并发访问。
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              简单易用
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              RESTful API设计，无需认证，一个URL即可获取随机图片。
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              灵活配置
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              支持参数筛选，可按分类、风格等条件获取特定类型图片。
            </p>
          </div>
        </div>

        {/* 统计信息 */}
        {apiStatus && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              服务统计
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {apiStatus.stats.totalImages}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  总图片数
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {apiStatus.stats.totalGroups}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  图片分组
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {apiStatus.services.api.enabled ? '启用' : '禁用'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  API状态
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  24/7
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  服务时间
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 dark:text-gray-300">
            <p>&copy; 2024 随机图片API服务. 基于 Next.js 和 Cloudinary 构建.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}