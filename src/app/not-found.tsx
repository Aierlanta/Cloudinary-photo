import Link from 'next/link'
import { CheckCircle2, Compass } from 'lucide-react'
import { OrnateIcon } from '@/components/ui/ornate-icon'

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
            <OrnateIcon icon={Compass} tone="lavender" size="lg" surface="light" />
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
                <OrnateIcon icon={CheckCircle2} tone="mint" size="sm" surface="light" />
                检查URL地址是否正确
              </li>
              <li className="flex items-center">
                <OrnateIcon icon={CheckCircle2} tone="mint" size="sm" surface="light" />
                返回首页重新导航
              </li>
              <li className="flex items-center">
                <OrnateIcon icon={CheckCircle2} tone="mint" size="sm" surface="light" />
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
