import Link from 'next/link'

/**
 * 404 页面未找到
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="text-center">
          {/* 404 图标 */}
          <div className="mx-auto w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-8">
            <svg 
              className="w-12 h-12 text-blue-600 dark:text-blue-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 20a7.962 7.962 0 01-5.657-2.343m0-11.314A7.962 7.962 0 0112 4a7.962 7.962 0 015.657 2.343M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
          </div>

          {/* 404 标题 */}
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
            404
          </h1>

          {/* 错误描述 */}
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
            页面未找到
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            抱歉，您访问的页面不存在。可能是链接错误，
            或者页面已被移动或删除。
          </p>

          {/* 建议操作 */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              您可以尝试：
            </h3>
            <ul className="text-left space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                检查URL地址是否正确
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                返回首页重新导航
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                使用搜索功能查找内容
              </li>
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              返回首页
            </Link>
            <Link
              href="/admin"
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              管理面板
            </Link>
          </div>

          {/* 快速链接 */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              快速链接
            </h4>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link
                href="/api/random"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                随机图片API
              </Link>
              <Link
                href="/admin/images"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                图片管理
              </Link>
              <Link
                href="/admin/groups"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                分组管理
              </Link>
              <Link
                href="/admin/config"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                API配置
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
