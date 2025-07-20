'use client'

import { useState, useEffect } from 'react'
import { Metadata } from 'next'

export default function APIDocsPage() {
  const [baseUrl, setBaseUrl] = useState<string>('')

  // 生成完整的基础URL
  const generateBaseUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.protocol}//${window.location.host}`
  }

  useEffect(() => {
    setBaseUrl(generateBaseUrl())
  }, [])
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            随机图片API文档
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            简单易用的随机图片API服务
          </p>
        </div>

        {/* 快速开始 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            快速开始
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                基础用法
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                直接访问API端点即可获取随机图片：
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  GET {baseUrl}/api/random
                </code>
                {baseUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(`${baseUrl}/api/random`)}
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制API地址"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                在HTML中使用
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {`<img src="${baseUrl}/api/random" alt="随机图片" />`}
                </code>
                {baseUrl && (
                  <button
                    onClick={() => navigator.clipboard.writeText(`<img src="${baseUrl}/api/random" alt="随机图片" />`)}
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制HTML代码"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                在JavaScript中使用
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-800 dark:text-gray-200">
{`fetch('${baseUrl}/api/random')
  .then(response => response.blob())
  .then(blob => {
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById('image').src = imageUrl;
  });`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* API参数 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            API参数
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                支持的参数
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                API支持通过查询参数来筛选特定类型的图片。具体可用参数由管理员配置决定。
              </p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        参数名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        说明
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        示例
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        category
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        图片分类
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <code>?category=nature</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        style
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        图片风格
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <code>?style=minimalist</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>注意：</strong> 具体可用的参数和参数值由系统管理员配置。
                  使用未配置的参数将被忽略或返回错误。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 响应格式 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            响应格式
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                成功响应
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                API直接返回图片文件，而不是JSON格式的响应。
              </p>
              
              <div className="space-y-3">
                <div>
                  <strong className="text-gray-900 dark:text-white">状态码：</strong>
                  <span className="text-green-600 dark:text-green-400 ml-2">200 OK</span>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">Content-Type：</strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">image/jpeg, image/png, image/webp 等</span>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">响应头：</strong>
                  <ul className="list-disc list-inside ml-6 mt-2 text-gray-600 dark:text-gray-300">
                    <li><code>X-Image-Id</code> - 图片唯一标识</li>
                    <li><code>X-Image-Filename</code> - 图片文件名</li>
                    <li><code>X-Response-Time</code> - 响应时间</li>
                    <li><code>Cache-Control</code> - 缓存控制</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                错误响应
              </h3>
              <div className="space-y-3">
                <div>
                  <strong className="text-red-600 dark:text-red-400">400 Bad Request</strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">- 请求参数无效</span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">403 Forbidden</strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">- API服务已禁用</span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">404 Not Found</strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">- 没有找到符合条件的图片</span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">429 Too Many Requests</strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">- 请求频率过高</span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">500 Internal Server Error</strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">- 服务器内部错误</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 使用示例 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            使用示例
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                在网页中显示随机图片
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-800 dark:text-gray-200">
{`<!DOCTYPE html>
<html>
<head>
    <title>随机图片示例</title>
</head>
<body>
    <h1>随机图片展示</h1>
    <img id="randomImage" src="${baseUrl}/api/random" alt="随机图片" style="max-width: 500px;">
    <br><br>
    <button onclick="refreshImage()">刷新图片</button>
    
    <script>
        function refreshImage() {
            const img = document.getElementById('randomImage');
            img.src = '${baseUrl}/api/random?' + new Date().getTime();
        }
    </script>
</body>
</html>`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                使用参数获取特定类型图片
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-800 dark:text-gray-200">
{`// 获取自然风景图片
fetch('${baseUrl}/api/random?category=nature')
  .then(response => response.blob())
  .then(blob => {
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById('natureImage').src = imageUrl;
  });

// 获取简约风格图片
fetch('${baseUrl}/api/random?style=minimalist')
  .then(response => response.blob())
  .then(blob => {
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById('minimalistImage').src = imageUrl;
  });`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* 注意事项 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            注意事项
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 dark:text-yellow-400 text-sm">!</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>频率限制：</strong> API有请求频率限制，请避免过于频繁的请求。
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-sm">i</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>缓存：</strong> 图片响应包含缓存头，建议客户端适当缓存以提高性能。
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>HTTPS：</strong> 建议使用HTTPS协议访问API以确保安全性。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
