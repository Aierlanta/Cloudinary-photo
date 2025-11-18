"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";

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

type FileStatus = "pending" | "uploading" | "success" | "failed";

interface FileUploadState {
  file: File;
  status: FileStatus;
  progress?: number;
  error?: string;
  uploadedImage?: Image;
  retryCount: number;
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
  const { t } = useLocale();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
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

  // 防止上传过程中意外离开页面（刷新、关闭、后退等）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 检查是否有正在上传的文件
      const isUploading =
        uploading || fileStates.some((fs) => fs.status === "uploading");

      if (isUploading) {
        // 标准的方式
        e.preventDefault();
        // Chrome 需要 returnValue
        e.returnValue = "图片正在上传中，确定要离开吗？上传将被中断。";
        return e.returnValue;
      }
    };

    // 添加事件监听器
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 清理函数
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading, fileStates]);

  // 拦截浏览器后退/前进按钮（popstate 事件）
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const isUploading =
        uploading || fileStates.some((fs) => fs.status === "uploading");

      if (isUploading) {
        // 弹出确认对话框
        const confirmLeave = window.confirm(
          "图片正在上传中，确定要离开吗？上传将被中断。"
        );

        if (!confirmLeave) {
          // 用户选择取消，阻止导航
          // 将历史记录推回到当前页面
          window.history.pushState(null, "", window.location.pathname);
        }
        // 如果用户选择确定，什么都不做，让导航继续
      }
    };

    // 监听浏览器后退/前进
    window.addEventListener("popstate", handlePopState);

    // 在上传开始时，向历史记录添加一个状态
    // 这样后退时会触发 popstate 事件
    if (uploading || fileStates.some((fs) => fs.status === "uploading")) {
      window.history.pushState(null, "", window.location.pathname);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [uploading, fileStates]);

  // 拦截页面内的所有链接点击和鼠标侧键
  useEffect(() => {
    const handleMouseClick = (e: MouseEvent) => {
      const isUploading =
        uploading || fileStates.some((fs) => fs.status === "uploading");

      if (!isUploading) return;

      // 检查是否是鼠标侧键（后退/前进按钮）
      // button 3 = 后退, button 4 = 前进
      if (e.button === 3 || e.button === 4) {
        const confirmLeave = window.confirm(
          "图片正在上传中，确定要离开吗？上传将被中断。"
        );

        if (!confirmLeave) {
          e.preventDefault();
          e.stopPropagation();
          // 阻止浏览器执行后退/前进操作
          window.history.pushState(null, "", window.location.pathname);
          return;
        }
      }

      // 检查是否点击了链接或包含链接的元素
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href) {
        // 如果是外部链接，beforeunload 会处理
        // 如果是内部链接，我们需要手动确认
        const currentOrigin = window.location.origin;
        const linkUrl = new URL(link.href, currentOrigin);

        // 检查是否是跳转到其他页面（不是当前页面的锚点）
        if (linkUrl.pathname !== window.location.pathname) {
          const confirmLeave = window.confirm(
            "图片正在上传中，确定要离开吗？上传将被中断。"
          );

          if (!confirmLeave) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    // 监听所有鼠标按下事件（包括侧键）
    document.addEventListener("mousedown", handleMouseClick, true);
    // 也监听点击事件作为备份
    document.addEventListener("click", handleMouseClick, true);

    return () => {
      document.removeEventListener("mousedown", handleMouseClick, true);
      document.removeEventListener("click", handleMouseClick, true);
    };
  }, [uploading, fileStates]);

  // 在页面显示上传状态提示
  useEffect(() => {
    if (uploading) {
      // 在控制台显示提示，帮助开发调试
      console.log("⚠️ 图片上传中，请勿关闭或刷新页面");
    }
  }, [uploading]);

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

    const newFileStates: FileUploadState[] = files.map((file) => ({
      file,
      status: "pending" as FileStatus,
      retryCount: 0,
    }));

    setFileStates((prev) => [...prev, ...newFileStates]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.startsWith("image/")
      );

      const newFileStates: FileUploadState[] = files.map((file) => ({
        file,
        status: "pending" as FileStatus,
        retryCount: 0,
      }));

      setFileStates((prev) => [...prev, ...newFileStates]);
    }
  };

  const removeFile = (index: number) => {
    setFileStates((prev) => prev.filter((_, i) => i !== index));
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

  // 更新文件状态
  const updateFileState = (
    index: number,
    updates: Partial<FileUploadState>
  ) => {
    setFileStates((prev) =>
      prev.map((fs, i) => (i === index ? { ...fs, ...updates } : fs))
    );
  };

  // 限制并发上传的函数
  const uploadWithConcurrencyLimit = async (
    fileStatesToUpload: FileUploadState[],
    startIndex: number = 0,
    maxConcurrency: number = 5
  ) => {
    const results: any[] = [];
    let completedCount = 0;

    // 上传单个文件的函数（带重试机制）
    const uploadSingleFile = async (
      fileState: FileUploadState,
      fileIndex: number,
      retryCount = 0
    ): Promise<any> => {
      const file = fileState.file;
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
          setUploadProgress((completedCount / fileStatesToUpload.length) * 100);

          // 更新文件状态为成功
          updateFileState(fileIndex, {
            status: "success",
            uploadedImage: data.data.image,
          });

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
            return uploadSingleFile(fileState, fileIndex, retryCount + 1);
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

            // 更新文件状态为失败
            updateFileState(fileIndex, {
              status: "failed",
              error: errorMessage,
            });

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
          return uploadSingleFile(fileState, fileIndex, retryCount + 1);
        } else {
          const errorMessage = `上传 ${file.name} 失败: ${
            error instanceof Error ? error.message : "网络错误"
          }`;

          // 更新文件状态为失败
          updateFileState(fileIndex, {
            status: "failed",
            error: errorMessage,
          });

          throw new Error(errorMessage);
        }
      }
    };

    // 使用更保守的并发控制，避免触发限流
    const semaphore = new Array(maxConcurrency).fill(null);
    let currentIndex = 0;

    const processFile = async (): Promise<any> => {
      if (currentIndex >= fileStatesToUpload.length) return null;

      const arrayIndex = currentIndex++;
      const fileState = fileStatesToUpload[arrayIndex];
      const realIndex = startIndex + arrayIndex;

      // 更新为上传中状态
      updateFileState(realIndex, { status: "uploading" });

      try {
        const result = await uploadSingleFile(fileState, realIndex);

        // 继续处理下一个文件
        const nextResult = await processFile();
        return nextResult ? [result, nextResult].flat() : result;
      } catch (error) {
        // 即使单个文件失败，也继续处理其他文件
        console.error(`文件 ${fileState.file.name} 上传失败:`, error);
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

  // 重试单个文件
  const retryFile = async (index: number) => {
    const fileState = fileStates[index];
    if (fileState.status !== "failed") return;

    updateFileState(index, {
      status: "uploading",
      error: undefined,
      retryCount: fileState.retryCount + 1,
    });

    try {
      await uploadWithConcurrencyLimit([fileState], index, 1);
      success("重试成功！", `${fileState.file.name} 已上传`, 3000);
    } catch (error) {
      showError(
        "重试失败",
        error instanceof Error ? error.message : "未知错误",
        4000
      );
    }
  };

  // 重试所有失败的文件
  const retryAllFailed = async () => {
    const failedFiles = fileStates.filter((fs) => fs.status === "failed");
    if (failedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const failedIndices = fileStates
        .map((fs, idx) => ({ fs, idx }))
        .filter(({ fs }) => fs.status === "failed");

      // 更新所有失败文件的状态
      failedIndices.forEach(({ idx }) => {
        updateFileState(idx, { status: "uploading", error: undefined });
      });

      // 并发上传所有失败的文件
      let retrySuccessCount = 0;
      let retryFailCount = 0;

      for (const { fs, idx } of failedIndices) {
        try {
          const res = await uploadWithConcurrencyLimit([fs], idx, 1);
          const count = Array.isArray(res) ? res.length : res ? 1 : 0;
          if (count > 0) {
            retrySuccessCount += count;
          } else {
            retryFailCount += 1;
          }
        } catch (error) {
          console.error(`重试 ${fs.file.name} 失败:`, error);
          retryFailCount += 1;
        }
      }

      if (retryFailCount > 0) {
        showError(
          "部分重试失败",
          `成功: ${retrySuccessCount} 张，失败: ${retryFailCount} 张`,
          6000
        );
      } else {
        success("全部重试成功！", `成功上传 ${retrySuccessCount} 张图片`, 4000);
      }
    } catch (error) {
      console.error("重试失败:", error);
      showError(
        "重试失败",
        error instanceof Error ? error.message : "未知错误",
        6000
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 清除所有成功的文件
  const clearSuccessful = () => {
    setFileStates((prev) => prev.filter((fs) => fs.status !== "success"));
  };

  // 清除所有文件
  const clearAll = () => {
    setFileStates([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    const pendingFiles = fileStates.filter((fs) => fs.status === "pending");
    if (pendingFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    let uploadedImages: Image[] = [];

    try {
      // 降低并发数量，避免触发限流（从5降到3）
      const pendingIndices = fileStates
        .map((fs, idx) => ({ fs, idx }))
        .filter(({ fs }) => fs.status === "pending");

      const startIdx = pendingIndices.length > 0 ? pendingIndices[0].idx : 0;
      uploadedImages = await uploadWithConcurrencyLimit(
        pendingFiles,
        startIdx,
        3
      );

      // 通知父组件上传成功
      uploadedImages.forEach((image: Image) => onUploadSuccess(image));

      // 只清除成功的文件和标签
      setTags("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const successCount = uploadedImages.length;
      const failedCount = pendingFiles.length - successCount;

      if (failedCount > 0) {
        showError(
          "部分上传失败",
          `成功: ${successCount} 张，失败: ${failedCount} 张`,
          6000
        );
      } else {
        success("上传完成！", `成功上传 ${successCount} 张图片`, 4000);
      }
    } catch (error) {
      console.error("上传失败:", error);
      const successCount = uploadedImages.length;
      const failedCount = Math.max(pendingFiles.length - successCount, 0);

      if (successCount > 0) {
        showError(
          "部分上传失败",
          `成功: ${successCount} 张，失败: ${failedCount} 张`,
          6000
        );
      } else {
        showError(
          "上传失败",
          error instanceof Error ? error.message : "未知错误",
          6000
        );
      }
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
              {t.adminImages.dragDropHint}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 panel-text mt-1">
              {t.adminImages.supportedFormats}
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
      {fileStates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium panel-text">
              文件列表 ({fileStates.length} 个文件)
            </h3>
            <div className="flex gap-2">
              {fileStates.some((fs) => fs.status === "success") && (
                <button
                  onClick={clearSuccessful}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  清除成功
                </button>
              )}
              <button
                onClick={clearAll}
                className="text-xs text-red-500 hover:text-red-700"
              >
                清除全部
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {fileStates.map((fileState, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded ${
                  fileState.status === "success"
                    ? "bg-green-50 dark:bg-green-900 dark:bg-opacity-20"
                    : fileState.status === "failed"
                    ? "bg-red-50 dark:bg-red-900 dark:bg-opacity-20"
                    : fileState.status === "uploading"
                    ? "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20"
                    : "bg-gray-50 dark:bg-gray-800"
                }`}
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium panel-text truncate">
                        {fileState.file.name}
                      </p>
                      {fileState.status === "uploading" && (
                        <span className="text-xs text-blue-600">上传中...</span>
                      )}
                      {fileState.status === "success" && (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                      {fileState.status === "failed" && (
                        <span className="text-xs text-red-600">✗</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(fileState.file.size)}
                      {fileState.retryCount > 0 &&
                        ` · 已重试 ${fileState.retryCount} 次`}
                    </p>
                    {fileState.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 truncate">
                        {fileState.error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {fileState.status === "failed" && (
                    <button
                      onClick={() => retryFile(index)}
                      className="text-blue-500 hover:text-blue-700 px-2 py-1 text-xs rounded border border-blue-500 hover:bg-blue-50"
                      title="重试"
                    >
                      重试
                    </button>
                  )}
                  {fileState.status !== "uploading" && (
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
                  )}
                </div>
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
            {t.adminImages.storageService}
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
                if (!provider) return null;

                // 根据 provider.id 使用翻译
                const descMap: Record<string, string> = {
                  cloudinary: t.adminImages.cloudinaryDesc,
                  tgstate: t.adminImages.tgStateDesc,
                  telegram: t.adminImages.telegramDesc,
                };
                const desc = descMap[provider.id] || provider.description;

                return (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {desc}
                    </p>
                    {/* Telegram 直连警告提示 */}
                    {provider.id === "telegram" && (
                      <div className="flex items-start gap-1.5 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                        <svg
                          className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          <strong>安全提示:</strong> 此图床仅支持通过{" "}
                          <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded text-yellow-900 dark:text-yellow-100">
                            /api/response
                          </code>{" "}
                          访问,不支持{" "}
                          <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 rounded text-yellow-900 dark:text-yellow-100">
                            /api/random
                          </code>{" "}
                          端点,以保护 Bot Token 安全。
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            {t.adminImages.selectGroup} {t.adminImages.groupOptional}
          </label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          >
            <option value="">{t.adminImages.selectGroupPlaceholder}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium panel-text mb-1">
            {t.adminImages.tagsOptional}
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t.adminImages.tagsPlaceholder}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 panel-text"
          />
        </div>
      </div>

      {/* 上传按钮和进度 */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleUpload}
            disabled={
              fileStates.filter((fs) => fs.status === "pending").length === 0 ||
              uploading
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-3 rounded text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                {Math.round(uploadProgress)}%
              </div>
            ) : (
              `${t.adminImages.uploadCount.replace(
                "{count}",
                String(
                  fileStates.filter((fs) => fs.status === "pending").length
                )
              )}`
            )}
          </button>

          {fileStates.some((fs) => fs.status === "failed") && (
            <button
              onClick={retryAllFailed}
              disabled={uploading}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium py-2 px-3 rounded text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              重试失败 (
              {fileStates.filter((fs) => fs.status === "failed").length})
            </button>
          )}
        </div>

        {uploading && (
          <>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>

            {/* 上传中警告提示 */}
            <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded text-sm text-yellow-800 dark:text-yellow-200">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">
                正在上传，请勿关闭或刷新页面，否则上传将被中断
              </span>
            </div>
          </>
        )}
      </div>

      {/* Toast通知容器 */}
      <ToastContainer
        toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))}
      />
    </div>
  );
}
