"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import {
  UploadCloud,
  X,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import type {
  ImageUrlImportRequest,
  ImageUrlImportResponse,
} from "@/types/api";

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
  onUploadSuccess?: (image?: Image) => void;
}

interface StorageProvider {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  features: string[];
}

export default function ImageUpload({
  groups = [],
  onUploadSuccess,
}: ImageUploadProps) {
  const { t } = useLocale();
  const {
    getProvidersFailed,
    getProvidersFailedMessage,
  } = t.adminImages;
  const isLight = useTheme();

  // 确保 groups 是数�?
  const safeGroups = Array.isArray(groups) ? groups : [];
  const [uploading, setUploading] = useState(false);
  const [currentBatchTotal, setCurrentBatchTotal] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileStates, setFileStates] = useState<FileUploadState[]>([]);
  const [groupId, setGroupId] = useState("");
  const [tags, setTags] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("cloudinary"); // 新增：图床选择
  const [providers, setProviders] = useState<StorageProvider[]>([]); // 新增：图床提供商列表
  const [loadingProviders, setLoadingProviders] = useState(true); // 新增：加载状�?
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"txt" | "json">("txt");
  const [importContent, setImportContent] = useState("");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] =
    useState<ImageUrlImportResponse | null>(null);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFilesCount = fileStates.filter((fs) => fs.status === "pending").length;

  // Toast通知
  const { toasts, success, error: showError, removeToast } = useToast();

  // 获取图床提供商列�?
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch("/api/admin/storage/providers");
        if (response.ok) {
          const data = await response.json();
          setProviders(data.data.providers);
          // 设置默认选择第一个可用的提供�?
          const availableProvider = data.data.providers.find(
            (p: StorageProvider) => p.isAvailable
          );
          if (availableProvider) {
            setSelectedProvider(availableProvider.id);
          }
        }
      } catch (error) {
        console.error("获取图床提供商列表失败", error);
        showError(getProvidersFailed, getProvidersFailedMessage);
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, [showError, getProvidersFailed, getProvidersFailedMessage]);

  // 确保选中的图床服务是可用的
  useEffect(() => {
    if (providers.length > 0) {
      const currentProvider = providers.find(
        (p) => p.id === selectedProvider
      );
      // 如果当前选中的图床不可用，切换到第一个可用的图床
      if (currentProvider && !currentProvider.isAvailable) {
        const availableProvider = providers.find(
          (p) => p.isAvailable
        );
        if (availableProvider) {
          setSelectedProvider(availableProvider.id);
        }
      }
    }
  }, [providers, selectedProvider]);

  // 防止上传过程中意外离开页面（刷新、关闭、后退等）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 检查是否有正在上传的文�?
      const isUploading =
        uploading || fileStates.some((fs) => fs.status === "uploading");

      if (isUploading) {
        // 标准的方�?
        e.preventDefault();
        // Chrome 需�?returnValue
        e.returnValue = "图片正在上传中，确定要离开吗？上传将被中断";
        return e.returnValue;
      }
    };

    // 添加事件监听�?
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 清理函数
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading, fileStates]);

  // 拦截浏览器后退/前进按钮（popstate 事件�?
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const isUploading =
        uploading || fileStates.some((fs) => fs.status === "uploading");

      if (isUploading) {
        // 弹出确认对话�?
        const confirmLeave = window.confirm(
          "图片正在上传中，确定要离开吗？上传将被中断"
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
          "图片正在上传中，确定要离开吗？上传将被中断"
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
        // 如果是外部链接，beforeunload 会处�?
        // 如果是内部链接，我们需要手动确�?
        const currentOrigin = window.location.origin;
        const linkUrl = new URL(link.href, currentOrigin);

        // 检查是否是跳转到其他页面（不是当前页面的锚点）
        if (linkUrl.pathname !== window.location.pathname) {
          const confirmLeave = window.confirm(
            "图片正在上传中，确定要离开吗？上传将被中断"
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

  const handleCustomFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result ?? "");
      setImportContent(text);
    };
    reader.onerror = () => {
      showError(
        t.adminImages.urlImportFailedTitle,
        t.adminImages.urlImportReadErrorMessage,
        4000
      );
    };
    reader.readAsText(file);
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
              })，{retryDelay}ms后重试（第{retryCount + 1}次重试）`
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
            `上传 ${file.name} 网络错误，{retryDelay}ms后重试（第{
              retryCount + 1
            }次重试）：`,
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
      success(t.adminImages.retrySuccess, t.adminImages.retrySuccessMessage.replace('{name}', fileState.file.name), 3000);
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
        success(t.adminImages.retryAllSuccess, t.adminImages.retryAllSuccessMessage.replace('{count}', String(retrySuccessCount)), 4000);
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

  const handleCustomImport = async () => {
    if (selectedProvider !== "custom") return;

    const trimmedContent = importContent.trim();
    if (!trimmedContent) {
      showError(
        t.adminImages.urlImportEmptyErrorTitle,
        t.adminImages.urlImportEmptyErrorMessage,
        4000
      );
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setLastImportResult(null);

    try {
      const payload: ImageUrlImportRequest = {
        provider: "custom",
        groupId: groupId || undefined,
        mode: importMode,
        content: trimmedContent,
      };

      const response = await fetch("/api/admin/images/import-urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = t.adminImages.urlImportFailedDefault;
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) {
            message = errorData.error.message;
          }
        } catch {
          // ignore
        }
        showError(t.adminImages.urlImportFailedTitle, message, 6000);
        return;
      }

      const json = await response.json();
      const result: ImageUrlImportResponse = json.data;

      setLastImportResult(result);
      setUploadProgress(100);

      const statsMessage = t.adminImages.urlImportStats
        .replace("{total}", String(result.total))
        .replace("{success}", String(result.success))
        .replace("{failed}", String(result.failed));

      if (result.failed > 0 && result.success > 0) {
        showError(t.adminImages.urlImportPartialTitle, statsMessage, 6000);
      } else if (result.failed > 0) {
        showError(t.adminImages.urlImportFailedTitle, statsMessage, 6000);
      } else {
        success(t.adminImages.urlImportSuccessTitle, statsMessage, 4000);
      }

      setImportContent("");
      setImportFileName(null);

      // 通知父组件刷新列表（自定义导入没有具体的 Image 对象，这里只发信号）
      onUploadSuccess?.();
    } catch (e) {
      console.error("批量URL导入失败:", e);
      showError(
        t.adminImages.urlImportFailedTitle,
        t.adminImages.urlImportUnknownError,
        6000
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    const pendingFiles = fileStates.filter((fs) => fs.status === "pending");
    if (pendingFiles.length === 0) return;

    setCurrentBatchTotal(pendingFiles.length);
    setUploading(true);
    setUploadProgress(0);

    let uploadedImages: Image[] = [];

    try {
      // 降低并发数量，避免触发限流（降到3）
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
      uploadedImages.forEach((image: Image) => onUploadSuccess?.(image));

      // 只清除成功的文件和标签
      setTags("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const successCount = uploadedImages.length;
      const failedCount = pendingFiles.length - successCount;

      if (failedCount > 0) {
        showError(
          t.adminImages.uploadPartialFailed,
          t.adminImages.uploadPartialFailedMessage.replace('{success}', String(successCount)).replace('{failed}', String(failedCount)),
          6000
        );
      } else {
        success(t.adminImages.uploadComplete, t.adminImages.uploadCompleteMessage.replace('{count}', String(successCount)), 4000);
      }
    } catch (error) {
      console.error("上传失败:", error);
      const successCount = uploadedImages.length;
      const failedCount = Math.max(pendingFiles.length - successCount, 0);

      if (successCount > 0) {
        showError(
          t.adminImages.uploadPartialFailed,
          t.adminImages.uploadPartialFailedMessage.replace('{success}', String(successCount)).replace('{failed}', String(failedCount)),
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
      setCurrentBatchTotal(0);
    }
  };

  // --- V3 Layout (Flat Design) ---
  return (
      <div className="space-y-4 rounded-lg">
        {/* Drag & Drop Zone */}
        <div
          className={cn(
            "border-2 border-dashed p-4 text-center transition-colors rounded-lg",
            dragActive
              ? isLight
                ? "border-blue-500 bg-blue-50"
                : "border-blue-600 bg-blue-900/20"
              : isLight
              ? "border-gray-300 hover:border-gray-400"
              : "border-gray-600 hover:border-gray-500"
          )}
          onDragEnter={selectedProvider === "custom" ? undefined : handleDrag}
          onDragLeave={selectedProvider === "custom" ? undefined : handleDrag}
          onDragOver={selectedProvider === "custom" ? undefined : handleDrag}
          onDrop={selectedProvider === "custom" ? undefined : handleDrop}
        >
          <div className="space-y-3">
            {selectedProvider === "custom" ? (
              <>
                <div className={cn(
                  "mx-auto w-12 h-12 flex items-center justify-center rounded-lg",
                  isLight ? "bg-gray-100" : "bg-gray-800"
                )}>
                  <ImageIcon className={cn(
                    "w-6 h-6 rounded-lg",
                    isLight ? "text-gray-400" : "text-gray-500"
                  )} />
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-medium rounded-lg",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminImages.urlImportTitle}
                  </p>
                  <p className={cn(
                    "text-xs mt-1 rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t.adminImages.urlImportSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs mt-2 rounded-lg">
                  <div className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 border rounded-lg",
                    isLight
                      ? "bg-gray-100 border-gray-200"
                      : "bg-gray-800 border-gray-700"
                  )}>
                    <span className={cn(
                      "font-medium rounded-lg",
                      isLight ? "text-gray-900" : "text-gray-100"
                    )}>
                      {t.adminImages.urlImportModeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode("txt");
                        setLastImportResult(null);
                      }}
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-lg",
                        importMode === "txt"
                          ? "bg-blue-500 text-white"
                          : isLight
                          ? "bg-transparent text-gray-500"
                          : "bg-transparent text-gray-400"
                      )}
                    >
                      {t.adminImages.urlImportModeTxt}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode("json");
                        setLastImportResult(null);
                      }}
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-lg",
                        importMode === "json"
                          ? "bg-blue-500 text-white"
                          : isLight
                          ? "bg-transparent text-gray-500"
                          : "bg-transparent text-gray-400"
                      )}
                    >
                      {t.adminImages.urlImportModeJson}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => customFileInputRef.current?.click()}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 border border-dashed text-xs transition-colors rounded-lg",
                      isLight
                        ? "border-gray-300 text-gray-600 hover:border-gray-400"
                        : "border-gray-600 text-gray-300 hover:border-gray-500"
                    )}
                  >
                    <UploadCloud className="w-4 h-4" />
                    {t.adminImages.urlImportSelectFile}
                  </button>
                  {importFileName && (
                    <span className={cn(
                      "text-xs rounded-lg",
                      isLight ? "text-gray-500" : "text-gray-400"
                    )}>
                      {importFileName}
                    </span>
                  )}
                </div>
                <textarea
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  placeholder={
                    importMode === "txt"
                      ? t.adminImages.urlImportTxtPlaceholder
                      : t.adminImages.urlImportJsonPlaceholder
                  }
                  className={cn(
                    "mt-3 w-full min-h-[100px] text-sm border px-2 py-1.5 resize-y focus:outline-none focus:border-blue-500 rounded-lg",
                    isLight
                      ? "bg-white border-gray-300"
                      : "bg-gray-800 border-gray-600"
                  )}
                />
                <div className={cn(
                  "mt-2 px-2 py-1.5 border border-dashed rounded-lg",
                  isLight
                    ? "bg-gray-50 border-gray-300"
                    : "bg-gray-900/60 border-gray-700"
                )}>
                  <p className={cn(
                    "text-[11px] mb-1 rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {importMode === "txt"
                      ? t.adminImages.urlImportTxtExampleTitle
                      : t.adminImages.urlImportJsonExampleTitle}
                  </p>
                  <pre className={cn(
                    "text-[11px] whitespace-pre-wrap break-all font-mono rounded-lg",
                    isLight ? "text-gray-600" : "text-gray-300"
                  )}>
                    {importMode === "txt"
                      ? "https://example.com/image1.jpg\nhttps://example.com/image2.jpg"
                      : '[\n  "https://example.com/image1.jpg",\n  "https://example.com/image2.jpg"\n]'}
                  </pre>
                </div>
                {lastImportResult && (
                  <p className={cn(
                    "mt-1 text-xs rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t.adminImages.urlImportLastResult
                      .replace("{total}", String(lastImportResult.total))
                      .replace("{success}", String(lastImportResult.success))
                      .replace("{failed}", String(lastImportResult.failed))}
                  </p>
                )}
                <div className="mt-3 flex justify-center rounded-lg">
                  <button
                    type="button"
                    onClick={handleCustomImport}
                    disabled={uploading}
                    className={cn(
                      "px-4 py-2 border transition-colors rounded-lg",
                      uploading
                        ? isLight
                          ? "bg-gray-400 text-white border-gray-500 cursor-not-allowed"
                          : "bg-gray-600 text-white border-gray-500 cursor-not-allowed"
                        : isLight
                        ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                        : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                    )}
                  >
                    {uploading
                      ? t.adminImages.urlImporting
                      : t.adminImages.urlImportButton}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={cn(
                  "mx-auto w-12 h-12 flex items-center justify-center rounded-lg",
                  isLight ? "bg-gray-100" : "bg-gray-800"
                )}>
                  <UploadCloud className={cn(
                    "w-6 h-6 rounded-lg",
                    isLight ? "text-gray-400" : "text-gray-500"
                  )} />
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-medium mb-1 rounded-lg",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminImages.dragDropHint}
                  </p>
                  <p className={cn(
                    "text-xs rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t.adminImages.supportedFormats}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "px-4 py-2 border transition-colors rounded-lg",
                    isLight
                      ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                      : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
                  )}
                >
                  {t.adminImages.selectFiles}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Provider Selection */}
        {providers.length > 1 && (
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium rounded-lg",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.storageService}
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                const provider = providers.find((p) => p.id === e.target.value);
                if (provider && provider.isAvailable) {
                  setSelectedProvider(e.target.value);
                }
              }}
              className={cn(
                "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
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
          </div>
        )}

        {/* Group and Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg">
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium rounded-lg",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.selectGroup} {t.adminImages.groupOptional}
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={cn(
                "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            >
              <option value="">选择分组</option>
              {safeGroups.length > 0 ? (
                safeGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))
              ) : null}
            </select>
          </div>
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium rounded-lg",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.tagsOptional}
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t.adminImages.tagsPlaceholder}
              className={cn(
                "w-full px-3 py-2 border outline-none focus:border-blue-500 rounded-lg",
                isLight
                  ? "bg-white border-gray-300"
                  : "bg-gray-800 border-gray-600"
              )}
            />
          </div>
        </div>

        {/* Upload Button */}
        {selectedProvider !== "custom" && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleUpload}
              disabled={pendingFilesCount === 0 || uploading}
              className={cn(
                "px-6 py-2 border transition-colors rounded-lg",
                pendingFilesCount === 0 || uploading
                  ? isLight
                    ? "bg-gray-400 text-white border-gray-500 cursor-not-allowed"
                    : "bg-gray-600 text-white border-gray-500 cursor-not-allowed"
                  : isLight
                  ? "bg-blue-500 text-white border-blue-600 hover:bg-blue-600"
                  : "bg-blue-600 text-white border-blue-500 hover:bg-blue-700"
              )}
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
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
                  {t.adminImages.uploadCount.replace(
                    "{count}",
                    String(currentBatchTotal || pendingFilesCount)
                  )}
                </div>
              ) : (
                t.adminImages.uploadCount.replace(
                  "{count}",
                  String(pendingFilesCount)
                )
              )}
            </button>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2 rounded-lg">
            <div className={cn(
              "w-full h-1.5",
              isLight ? "bg-gray-200" : "bg-gray-700"
            )}>
              <div
                className={cn(
                  "h-full transition-all",
                  isLight ? "bg-blue-500" : "bg-blue-600"
                )}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className={cn(
              "text-sm text-center rounded-lg",
              isLight ? "text-gray-600" : "text-gray-400"
            )}>
              {uploadProgress}%
            </p>
          </div>
        )}

        {/* File List Actions */}
        {fileStates.length > 0 && (
          <div className="flex justify-end gap-2">
            {fileStates.some((fs) => fs.status === "success") && (
              <button
                type="button"
                onClick={clearSuccessful}
                disabled={uploading}
                className={cn(
                  "text-xs px-2 py-1 border rounded-lg flex items-center gap-1 transition-colors",
                  isLight
                    ? "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                <Trash2 className="w-3 h-3" />
                {t.adminImages.clearSuccessful}
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              disabled={uploading}
              className={cn(
                "text-xs px-2 py-1 border rounded-lg flex items-center gap-1 transition-colors",
                isLight
                  ? "bg-white border-gray-300 text-red-600 hover:bg-red-50 hover:border-red-200"
                  : "bg-gray-800 border-gray-600 text-red-400 hover:bg-red-900/20 hover:border-red-800",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Trash2 className="w-3 h-3" />
              {t.adminImages.clearAll}
            </button>
          </div>
        )}

        {/* File List */}
        {fileStates.length > 0 && (
          <div className="space-y-1 max-h-96 overflow-y-auto rounded-lg">
            {fileStates.map((fileState, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between p-2 border rounded-lg",
                  fileState.status === "success"
                    ? isLight
                      ? "bg-green-50 border-green-200"
                      : "bg-green-900/20 border-green-800"
                    : fileState.status === "failed"
                    ? isLight
                      ? "bg-red-50 border-red-200"
                      : "bg-red-900/20 border-red-800"
                    : fileState.status === "uploading"
                    ? isLight
                      ? "bg-blue-50 border-blue-200"
                      : "bg-blue-900/20 border-blue-800"
                    : isLight
                    ? "bg-gray-50 border-gray-200"
                    : "bg-gray-800 border-gray-700"
                )}
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className={cn(
                    "w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-lg",
                    isLight ? "bg-gray-200" : "bg-gray-700"
                  )}>
                    <ImageIcon className={cn(
                      "w-4 h-4",
                      isLight ? "text-gray-500" : "text-gray-400"
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-sm truncate rounded-lg",
                        isLight ? "text-gray-900" : "text-gray-100"
                      )}>
                        {fileState.file.name}
                      </p>
                      {fileState.status === "success" && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 border rounded-lg",
                          isLight
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-green-900/20 border-green-800 text-green-400"
                        )}>
                          Success
                        </span>
                      )}
                      {fileState.status === "failed" && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 border rounded-lg",
                          isLight
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-red-900/20 border-red-800 text-red-400"
                        )}>
                          Failed
                        </span>
                      )}
                    </div>
                    {fileState.error && (
                      <p className={cn(
                        "text-xs truncate rounded-lg",
                        isLight ? "text-red-600" : "text-red-400"
                      )}>
                        {fileState.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2">
                  {fileState.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retryFile(index)}
                      disabled={fileState.status === "uploading"}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        isLight
                          ? "text-blue-600 hover:bg-blue-50"
                          : "text-blue-400 hover:bg-blue-900/20",
                        fileState.status === "uploading" && "opacity-50 cursor-not-allowed"
                      )}
                      title={t.adminImages.retry}
                    >
                      <RefreshCw className={cn("w-4 h-4", fileState.status === "uploading" && "animate-spin")} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={fileState.status === "uploading"}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isLight
                        ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                        : "text-gray-500 hover:text-red-400 hover:bg-red-900/20",
                      fileState.status === "uploading" && "opacity-50 cursor-not-allowed"
                    )}
                    title={t.adminImages.remove}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={customFileInputRef}
          type="file"
          accept=".txt,.json"
          onChange={handleCustomFileSelect}
          className="hidden"
        />
        <ToastContainer
          toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))}
        />
      </div>
    );
}
