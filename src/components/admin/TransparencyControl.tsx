'use client'

import { useState } from 'react'

interface TransparencyControlProps {
  opacity: number
  onChange: (opacity: number) => void
}

export default function TransparencyControl({ opacity, onChange }: TransparencyControlProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* 控制按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
        title="透明度控制"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21h10a2 2 0 002-2v-4a2 2 0 00-2-2H7" />
        </svg>
      </button>

      {/* 控制面板 */}
      {isOpen && (
        <div className="absolute top-14 right-0 w-80 transparent-panel rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold panel-text">透明度控制</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* 透明度滑块 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium panel-text">面板透明度</label>
                <span className="text-sm text-gray-600 dark:text-gray-300 panel-text">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* 预设值 */}
            <div>
              <label className="text-sm font-medium panel-text mb-2 block">快速设置</label>
              <div className="grid grid-cols-4 gap-2">
                {[0.3, 0.5, 0.7, 0.9].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onChange(preset)}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                      Math.abs(opacity - preset) < 0.05
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 panel-text'
                    }`}
                  >
                    {Math.round(preset * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* 说明文字 */}
            <div className="text-xs text-gray-500 dark:text-gray-400 panel-text">
              <p>调整管理面板的透明度，较低的透明度可以更好地显示背景内容。</p>
            </div>
          </div>
        </div>
      )}

      {/* 样式 */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  )
}