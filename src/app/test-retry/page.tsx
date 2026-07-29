'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'

export default function TestRetryPage() {
  // 开发调试页面：生产构建直接 404，避免暴露测试面
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  // 创建测试图片文件
  const createTestFile = (index: number): File => {
    // 创建一个1x1像素的PNG图片
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = `hsl(${index * 30}, 70%, 50%)`
    ctx.fillRect(0, 0, 1, 1)
    
    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(new File([blob!], `test-image-${index}.png`, { type: 'image/png' }))
      }, 'image/png')
    }) as any
  }

  // 带重试的上传函数
  const uploadWithRetry = async (file: File, maxRetries = 3): Promise<any> => {
    const retryableStatusCodes = [429, 500, 502, 503, 504]
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', `测试图片 ${file.name}`)
        formData.append('tags', JSON.stringify(['test', 'retry']))

        const startTime = Date.now()
        const response = await fetch('/api/admin/images', {
          method: 'POST',
          body: formData
        })

        const duration = Date.now() - startTime

        if (response.ok) {
          const data = await response.json()
          addLog(`✅ ${file.name} 上传成功 (${duration}ms)`)
          return { success: true, file: file.name, duration, data: data.data.image }
        } else {
          if (retryableStatusCodes.includes(response.status) && attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000)
            addLog(`⚠️ ${file.name} 上传失败 (${response.status})，${delay.toFixed(0)}ms后重试 (第${attempt + 1}次)`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          } else {
            const errorData = await response.json().catch(() => ({}))
            addLog(`❌ ${file.name} 上传失败 (${response.status}): ${errorData.error?.message || response.statusText}`)
            return { success: false, file: file.name, duration, error: errorData.error?.message }
          }
        }
      } catch (error) {
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000)
          addLog(`💥 ${file.name} 网络错误，${delay.toFixed(0)}ms后重试 (第${attempt + 1}次): ${error}`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        } else {
          addLog(`💥 ${file.name} 最终失败: ${error}`)
          return { success: false, file: file.name, error: String(error) }
        }
      }
    }
  }

  const testConcurrentUpload = async () => {
    setIsUploading(true)
    setResults([])
    setLogs([])
    
    addLog('🚀 开始并发上传测试...')
    
    // 创建多个测试文件
    const fileCount = 12 // 超过限流阈值
    const files: File[] = []
    
    for (let i = 1; i <= fileCount; i++) {
      files.push(createTestFile(i))
    }
    
    addLog(`📁 创建了 ${fileCount} 个测试文件`)
    
    // 并发上传
    const startTime = Date.now()
    const uploadPromises = files.map(file => uploadWithRetry(file))
    
    try {
      const results = await Promise.allSettled(uploadPromises)
      const totalDuration = Date.now() - startTime
      
      // 统计结果
      let successCount = 0
      let failureCount = 0
      const processedResults: any[] = []
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          processedResults.push(result.value)
          if (result.value.success) {
            successCount++
          } else {
            failureCount++
          }
        } else {
          failureCount++
          processedResults.push({ success: false, file: `file-${index}`, error: result.reason })
        }
      })
      
      setResults(processedResults)
      
      addLog(`\n📊 测试完成 (总耗时: ${totalDuration}ms)`)
      addLog(`✅ 成功: ${successCount}`)
      addLog(`❌ 失败: ${failureCount}`)
      addLog(`📈 成功率: ${((successCount / fileCount) * 100).toFixed(1)}%`)
      
    } catch (error) {
      addLog(`💥 测试过程中发生错误: ${error}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">上传重试机制测试</h1>
      
      <div className="mb-6">
        <button
          onClick={testConcurrentUpload}
          disabled={isUploading}
          className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
        >
          {isUploading ? '测试进行中...' : '开始并发上传测试'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 实时日志 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">实时日志</h2>
          <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap">
              {logs.join('\n')}
            </pre>
          </div>
        </div>

        {/* 结果统计 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">上传结果</h2>
          <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto">
            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded ${
                      result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    <div className="font-medium">
                      {result.success ? '✅' : '❌'} {result.file}
                    </div>
                    {result.duration && (
                      <div className="text-sm">耗时: {result.duration}ms</div>
                    )}
                    {result.error && (
                      <div className="text-sm">错误: {result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">暂无结果</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
