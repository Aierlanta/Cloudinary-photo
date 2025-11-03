"use client";

import { useState, useEffect } from "react";
import { useLocale, LocaleProvider } from "@/hooks/useLocale";

function APIDocsContent() {
  const { t } = useLocale();
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
            {t.apiDocs.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {t.apiDocs.subtitle}
          </p>
        </div>

        {/* API访问链接 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t.apiDocs.apiAccessLinks}
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.baseApiAddress}
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
                    title={t.apiDocs.copyApiAddress}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* API Key 鉴权说明 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t.apiDocs.apiKeyAuth}
          </h2>
          <div className="space-y-3 text-gray-700 dark:text-gray-300">
            <p>{t.apiDocs.apiKeyAuthDesc}</p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <p className="font-medium mb-2">{t.apiDocs.withApiKey}:</p>
              <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {baseUrl}/api/random?key=your-api-key
              </code>
            </div>
            <p className="text-sm">{t.apiDocs.apiKeyConfigTip}</p>
          </div>
        </div>

        {/* 使用示例 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t.apiDocs.usageExamples}
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.redirectMode}
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
                    title={t.apiDocs.copyLink}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.directResponseMode}
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
                    title={t.apiDocs.copyLink}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.withParamsR18}
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
                    title={t.apiDocs.copyLink}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.directResponseWithParamsR18}
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
                    title={t.apiDocs.copyLink}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.withParamsSfw}
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
                    title={t.apiDocs.copyLink}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.directResponseWithParamsSfw}
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
                    title={t.apiDocs.copyLink}
                  >
                    {t.common.copy}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 透明度调整功能 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t.apiDocs.transparencyAdjustment}
          </h2>

          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                /api/response
              </code>{" "}
              {t.apiDocs.transparencyIntro}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.parameterDescription}
              </h3>
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-start">
                    <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm text-blue-600 dark:text-blue-400 mr-3">
                      opacity
                    </code>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">
                        {t.apiDocs.opacityDesc}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line">
                        {t.apiDocs.opacityDetails}
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
                        {t.apiDocs.bgColorDesc}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        • <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">white</code> (default), {" "}
                        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">black</code>
                        <br />• Hex: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ffffff</code>, {" "}
                        <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">#ff6b6b</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.examples}
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t.apiDocs.opacity50White}
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
                        title={t.apiDocs.copyLink}
                      >
                        {t.common.copy}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t.apiDocs.opacity80Black}
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
                        title={t.apiDocs.copyLink}
                      >
                        {t.common.copy}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t.apiDocs.opacity30Custom}
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
                        title={t.apiDocs.copyLink}
                      >
                        {t.common.copy}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {t.apiDocs.withGroupParams}
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
                        title={t.apiDocs.copyLink}
                      >
                        {t.common.copy}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                {t.apiDocs.notes}
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• {t.apiDocs.note1}</li>
                <li>• {t.apiDocs.note2}</li>
                <li>• {t.apiDocs.note3}</li>
                <li>• {t.apiDocs.note4}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 响应格式 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t.apiDocs.responseFormat}
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.successResponse}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t.apiDocs.successResponseDesc}
              </p>

              <div className="space-y-3">
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    {t.apiDocs.statusCode}
                  </strong>
                  <span className="text-green-600 dark:text-green-400 ml-2">
                    200 OK
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    {t.apiDocs.contentType}
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    image/jpeg, image/png, image/webp
                  </span>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    {t.apiDocs.responseHeaders}
                  </strong>
                  <ul className="list-disc list-inside ml-6 mt-2 text-gray-600 dark:text-gray-300">
                    <li>
                      <code>X-Image-Id</code> - {t.apiDocs.imageId}
                    </li>
                    <li>
                      <code>X-Image-Filename</code> - {t.apiDocs.imageFilename}
                    </li>
                    <li>
                      <code>X-Response-Time</code> - {t.apiDocs.responseTime}
                    </li>
                    <li>
                      <code>Cache-Control</code> - {t.apiDocs.cacheControl}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t.apiDocs.errorResponse}
              </h3>
              <div className="space-y-3">
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    {t.apiDocs.badRequest}
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - {t.apiDocs.badRequestDesc}
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    {t.apiDocs.forbidden}
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - {t.apiDocs.forbiddenDesc}
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    {t.apiDocs.notFound}
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - {t.apiDocs.notFoundDesc}
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    {t.apiDocs.tooManyRequests}
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - {t.apiDocs.tooManyRequestsDesc}
                  </span>
                </div>
                <div>
                  <strong className="text-red-600 dark:text-red-400">
                    {t.apiDocs.internalError}
                  </strong>
                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                    - {t.apiDocs.internalErrorDesc}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 注意事项 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t.apiDocs.notice}
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
                  <strong>{t.apiDocs.rateLimit}</strong>{" "}
                  {t.apiDocs.rateLimitDesc}
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
                  <strong>{t.apiDocs.cache}</strong>{" "}
                  {t.apiDocs.cacheDesc}
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
                  <strong>{t.apiDocs.https}</strong>{" "}
                  {t.apiDocs.httpsDesc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function APIDocsPage() {
  return (
    <LocaleProvider>
      <APIDocsContent />
    </LocaleProvider>
  );
}
