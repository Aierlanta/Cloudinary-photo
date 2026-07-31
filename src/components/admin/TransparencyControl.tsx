'use client'

import { useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { Palette, X } from 'lucide-react'
import { OrnateIcon } from '@/components/ui/ornate-icon'

interface TransparencyControlProps {
  opacity: number
  onChange: (opacity: number) => void
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  isManualTheme: boolean
  onThemeReset: () => void
}

export default function TransparencyControl({ 
  opacity, 
  onChange, 
  theme, 
  onThemeToggle, 
  isManualTheme, 
  onThemeReset
}: TransparencyControlProps) {
  const { locale, t, toggleLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* 控制按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
        title={t.admin.transparencyControl}
      >
        <OrnateIcon icon={Palette} tone="lavender" size="sm" surface="light" />
      </button>

      {/* 控制面板 */}
      {isOpen && (
        <div className="absolute top-14 right-0 w-80 transparent-panel rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold panel-text">{t.admin.transparencyControl}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleLocale}
                  className="px-3 py-1 text-xs rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors font-semibold"
                  title={t.admin.toggleLanguage}
                >
                  <span>{locale === 'zh' ? t.adminUi.switchToEnglish : t.adminUi.switchToChinese}</span>
                </button>
                <button
                  onClick={onThemeToggle}
                  className="px-3 py-1 text-xs rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  {t.admin.toggleTheme}
                </button>
                {isManualTheme && (
                  <button
                    onClick={onThemeReset}
                    className="px-3 py-1 text-xs rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                  >
                    {t.admin.resetToBrowser}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 panel-text">
                {t.admin.currentMode}：{theme === 'light' ? t.admin.light : t.admin.dark}（{isManualTheme ? t.admin.manual : t.admin.followBrowser}）
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <OrnateIcon icon={X} tone="pink" size="sm" surface="light" />
            </button>
          </div>

          <div className="space-y-4">
            {/* 透明度滑块 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium panel-text">{t.admin.panelOpacity}</label>
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
              <label className="text-sm font-medium panel-text mb-2 block">{t.admin.quickSettings}</label>
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
              <p>{t.admin.opacityDescription}</p>
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
