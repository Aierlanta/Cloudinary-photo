"use client";

import { useState, useEffect } from "react";

export default function APIDocsPage() {
  const [baseUrl, setBaseUrl] = useState<string>("");

  // 生成完整的基础URL
  const generateBaseUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
  };

  useEffect(() => {
    setBaseUrl(generateBaseUrl());
  }, []);
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

        {/* API访问链接 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            API访问链接
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                基础API地址
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/random
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(`${baseUrl}/api/random`)
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制API地址"
                  >
                    复制
                  </button>
                )}
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
                重定向模式 (/api/random)
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/random
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(`${baseUrl}/api/random`)
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制链接"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                直接响应模式 (/api/response)
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/response
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(`${baseUrl}/api/response`)
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制链接"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                带参数 (r18=r18)
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/random?r18=r18
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${baseUrl}/api/random?r18=r18`
                      )
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制链接"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                直接响应带参数 (r18=r18)
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/response?r18=r18
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${baseUrl}/api/response?r18=r18`
                      )
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制链接"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                带参数 (sfw=sfw)
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/random?sfw=sfw
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${baseUrl}/api/random?sfw=sfw`
                      )
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制链接"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                直接响应带参数 (sfw=sfw)
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                  {baseUrl}/api/response?sfw=sfw
                </code>
                {baseUrl && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${baseUrl}/api/response?sfw=sfw`
                      )
                    }
                    className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="复制链接"
                  >
                    复制
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 透明度调整功能 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            透明度调整功能
          </h2>

          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                /api/response
              </code>{" "}
              端点支持图片透明度调整功能，可以通过参数调整图片的不透明度并合成到指定背景颜色上。
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                参数说明
              </h3>
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-start">
                    <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm text-blue-600 dark:text-blue-400 mr-3">
                      opacity
                    </code>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">
                        图片不透明度（0-1.0）
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        • 0 = 完全透明，1 = 完全不透明
                        <br />• 可选参数，不指定则不进行透明度处理
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <div className="flex items-start">
                    <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm text-green-600 dark:text-green-400 mr-3">
                      bgColor
                    </code>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">
                        背景颜色
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        • 预设颜色：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">white</code>（默认）、
                        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">black</code>
                        <br />• 十六进制：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ffffff</code> 或{" "}
                        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">#ff6b6b</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                使用示例
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    50% 透明度，白色背景
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                      {baseUrl}/api/response?opacity=0.5&bgColor=white
                    </code>
                    {baseUrl && (
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${baseUrl}/api/response?opacity=0.5&bgColor=white`
                          )
                        }
                        className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="复制链接"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    80% 透明度，黑色背景
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                      {baseUrl}/api/response?opacity=0.8&bgColor=black
                    </code>
                    {baseUrl && (
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${baseUrl}/api/response?opacity=0.8&bgColor=black`
                          )
                        }
                        className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="复制链接"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    30% 透明度，自定义颜色背景
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                      {baseUrl}/api/response?opacity=0.3&bgColor=ff6b6b
                    </code>
                    {baseUrl && (
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${baseUrl}/api/response?opacity=0.3&bgColor=ff6b6b`
                          )
                        }
                        className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="复制链接"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    结合分组参数使用
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <code className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                      {baseUrl}/api/response?sfw=sfw&opacity=0.6&bgColor=white
                    </code>
                    {baseUrl && (
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${baseUrl}/api/response?sfw=sfw&opacity=0.6&bgColor=white`
                          )
                        }
                        className="ml-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        title="复制链接"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                注意事项
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• 透明度处理会将图片转换为 JPEG 格式（质量90）</li>
                <li>• 使用透明度参数时不会使用预取缓存，响应时间会略长</li>
                <li>• 如果未指定 bgColor 参数，默认使用白色背景</li>
                <li>• 可以与其他分组参数组合使用</li>
              </ul>
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
                  <strong className="text-gray-900 dark:text-white">
                    状态码：
                  </strong>
                  <span className="text-green-600 dark:text-green-400 ml-2">
                    200 OK
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    Content-Type：
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    image/jpeg, image/png, image/webp 等
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    响应头：
                  </strong>
                  <ul className="list-disc list-inside ml-6 mt-2 text-gray-600 dark:text-gray-300">
                    <li>
                      <code>X-Image-Id</code> - 图片唯一标识
                    </li>
                    <li>
                      <code>X-Image-Filename</code> - 图片文件名
                    </li>
                    <li>
                      <code>X-Response-Time</code> - 响应时间
                    </li>
                    <li>
                      <code>Cache-Control</code> - 缓存控制
                    </li>
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
                  <strong className="text-red-600 dark:text-red-400">
                    400 Bad Request
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - 请求参数无效
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    403 Forbidden
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - API服务已禁用
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    404 Not Found
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - 没有找到符合条件的图片
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    429 Too Many Requests
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - 请求频率过高
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    500 Internal Server Error
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - 服务器内部错误
                  </span>
                </div>
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
                  <span className="text-yellow-600 dark:text-yellow-400 text-sm">
                    !
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>频率限制：</strong>{" "}
                  API有请求频率限制，请避免过于频繁的请求。
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 text-sm">
                    i
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>缓存：</strong>{" "}
                  图片响应包含缓存头，建议客户端适当缓存以提高性能。
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 text-sm">
                    ✓
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>HTTPS：</strong>{" "}
                  建议使用HTTPS协议访问API以确保安全性。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
