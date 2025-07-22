"use client";

import { useState, useRef } from "react";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  imageCount: number;
}

interface Image {
  id: string;
  cloudinaryId: string;
  publicId: string;
  url: string;
  secureUrl: string;
  filename: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  groupId?: string;
  uploadedAt: string;
  tags: string[];
}

interface ImageUploadProps {
  groups: Group[];
  onUploadSuccess: (image: Image) => void;
}

interface StorageProvider {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  features: string[];
}

export default function ImageUpload({
  groups,
  onUploadSuccess,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [groupId, setGroupId] = useState("");
  const [tags, setTags] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("cloudinary"); // 新增：图床选择
  const [providers, setProviders] = useState<StorageProvider[]>([]); // 新增：图床提供商列表
  const [loadingProviders, setLoadingProviders] = useState(true); // 新增：加载状态
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast通知
  const { toasts, success, error: showError, removeToast } = useToast();

  // 获取图床提供商列表
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch("/api/admin/storage/providers");
        if (response.ok) {
          const data = await response.json();
          setProviders(data.data.providers);
          // 设置默认选择第一个可用的提供商
          const availableProvider = data.data.providers.find(
            (p: StorageProvider) => p.isAvailable
          );
          if (availableProvider) {
            setSelectedProvider(availableProvider.id);
          }
        }
      } catch (error) {
        console.error("获取图床提供商列表失败:", error);
        showError("获取图床服务列表失败", "请刷新页面重试");
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, [showError]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );
    setSelectedFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.startsWith("image/")
      );
      setSelectedFiles(files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 重试配置
  const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000, // 1秒
    maxDelay: 10000, // 10秒
    retryableStatusCodes: [429, 500, 502, 503, 504], // 可重试的状态码
  };

  // 带重试的延迟函数
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // 计算重试延迟（指数退避）
  const calculateRetryDelay = (attempt: number) => {
    const exponentialDelay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 添加随机抖动避免雷群效应
    return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelay);
  };

  // 限制并发上传的函数
  const uploadWithConcurrencyLimit = async (
    files: File[],
    maxConcurrency: number = 5
  ) => {
    const results: any[] = [];
    let completedCount = 0;

    // 上传单个文件的函数（带重试机制）
    const uploadSingleFile = async (
      file: File,
      retryCount = 0
    ): Promise<any> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("provider", selectedProvider); // 新增：图床选择
      if (groupId) formData.append("groupId", groupId);
      if (tags) formData.append("tags", tags);

      try {
        const response = await fetch("/api/admin/images", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          completedCount++;
          setUploadProgress((completedCount / files.length) * 100);
          return data.data.image;
        } else {
          // 检查是否是可重试的错误
          if (
            RETRY_CONFIG.retryableStatusCodes.includes(response.status) &&
            retryCount < RETRY_CONFIG.maxRetries
          ) {
            const retryDelay = calculateRetryDelay(retryCount);
            console.warn(
              `上传 ${file.name} 失败 (状态码: ${
                response.status
              })，${retryDelay}ms后重试 (第${retryCount + 1}次重试)`
            );

            await delay(retryDelay);
            return uploadSingleFile(file, retryCount + 1);
          } else {
            // 获取错误详情
            let errorMessage = `上传 ${file.name} 失败 (状态码: ${response.status})`;
            try {
              const errorData = await response.json();
              if (errorData.error?.message) {
                errorMessage = `上传 ${file.name} 失败: ${errorData.error.message}`;
              }
            } catch {
              // 忽略解析错误响应的错误
            }
            throw new Error(errorMessage);
          }
        }
      } catch (error) {
        // 网络错误等非HTTP错误
        if (retryCount < RETRY_CONFIG.maxRetries) {
          const retryDelay = calculateRetryDelay(retryCount);
          console.warn(
            `上传 ${file.name} 网络错误，${retryDelay}ms后重试 (第${
              retryCount + 1
            }次重试):`,
            error
          );

          await delay(retryDelay);
          return uploadSingleFile(file, retryCount + 1);
        } else {
          throw new Error(
            `上传 ${file.name} 失败: ${
              error instanceof Error ? error.message : "网络错误"
            }`
          );
        }
      }
    };

    // 使用更保守的并发控制，避免触发限流
    const semaphore = new Array(maxConcurrency).fill(null);
    let currentIndex = 0;

    const processFile = async (): Promise<any> => {
      if (currentIndex >= files.length) return null;

      const fileIndex = currentIndex++;
      const file = files[fileIndex];

      try {
        const result = await uploadSingleFile(file);

        // 继续处理下一个文件
        const nextResult = await processFile();
        return nextResult ? [result, nextResult].flat() : result;
      } catch (error) {
        // 即使单个文件失败，也继续处理其他文件
        console.error(`文件 ${file.name} 上传失败:`, error);
        const nextResult = await processFile();
        throw error; // 重新抛出错误，但不阻止其他文件的处理
      }
    };

    // 启动并发上传
    const uploadPromises = semaphore.map(() => processFile());

    try {
      const allResults = await Promise.allSettled(uploadPromises);

      // 收集成功的结果
      const successfulResults: any[] = [];
      const errors: string[] = [];

      allResults.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          const values = Array.isArray(result.value)
            ? result.value
            : [result.value];
          successfulResults.push(...values.filter((v) => v !== null));
        } else if (result.status === "rejected") {
          errors.push(result.reason?.message || `上传失败`);
        }
      });

      // 如果有错误但也有成功的上传，显示部分成功的消息
      if (errors.length > 0 && successfulResults.length > 0) {
        console.warn("部分文件上传失败:", errors);
      } else if (errors.length > 0) {
        throw new Error(`所有文件上传失败: ${errors.join(", ")}`);
      }

      return successfulResults;
    } catch (error) {
      // 如果所有上传都失败了，重新抛出错误
      throw error;
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // 降低并发数量，避免触发限流（从5降到3）
      const uploadedImages = await uploadWithConcurrencyLimit(selectedFiles, 3);

      // 通知父组件上传成功
      uploadedImages.forEach((image) => onUploadSuccess(image));

      // 重置表单
      setSelectedFiles([]);
      setTags("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      success("上传完成！", `成功上传 ${uploadedImages.length} 张图片`, 4000);
    } catch (error) {
      console.error("上传失败:", error);
      showError(
        "上传失败",
        error instanceof Error ? error.message : "未知错误",
        6000
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* 拖拽上传区域 */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-3">
          <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium panel-text">
              拖拽图片到此处，或
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 ml-1"
              >
                点击选择文件
              </button>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 panel-text mt-1">
              支持 JPG、PNG、GIF、WebP 格式，单个文件最大 10MB
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 已选择的文件列表 */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium panel-text">
            已选择的文件 ({selectedFiles.length})
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium panel-text truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上传选项 */}
      <div className="space-y-3">
        {/* 图床选择器 */}
        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            图床服务
          </label>
          {loadingProviders ? (
            <div className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 panel-text">
              加载中...
            </div>
          ) : (
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
            >
              {providers.map((provider) => (
                <option
                  key={provider.id}
                  value={provider.id}
                  disabled={!provider.isAvailable}
                >
                  {provider.name} {!provider.isAvailable && "(不可用)"}
                </option>
              ))}
            </select>
          )}
          {/* 显示选中图床的描述 */}
          {selectedProvider && providers.length > 0 && (
            <div className="mt-1">
              {(() => {
                const provider = providers.find(
                  (p) => p.id === selectedProvider
                );
                return provider ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {provider.description}
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            分组 (可选)
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="">选择分组...</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            标签 (可选，用逗号分隔)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例如: 风景, 自然, 蓝天"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
        </div>
      </div>

      {/* 上传按钮和进度 */}
      <div className="space-y-2">
        <button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-3 rounded text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {uploading ? (
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              上传中... ({Math.round(uploadProgress)}%)
            </div>
          ) : (
            `上传 ${selectedFiles.length} 张图片`
          )}
        </button>

        {uploading && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
      </div>

      {/* Toast通知容器 */}
      <ToastContainer
        toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))}
      />
    </div>
  );
}
