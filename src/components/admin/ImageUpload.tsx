"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import type {
  ImageUrlImportRequest,
  ImageUrlImportResponse,
} from "@/types/api";
import { getNodeDisplayName, useAdminApi } from "@/lib/admin-api-client";

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string | Date;
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
  previewUrl?: string;
}

interface UploadQueueItem {
  fileState: FileUploadState;
  index: number;
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

type UploadStrategy = "manual" | "round-robin" | "random" | "available-first";
const UPLOAD_CONCURRENCY_LIMIT = 3;

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
  const { adminFetch, selectedNodeId, fetchNode, nodes, nodeStatuses } = useAdminApi();

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
  const [uploadStrategy, setUploadStrategy] = useState<UploadStrategy>("manual");
  const [manualTargetNodeId, setManualTargetNodeId] = useState(selectedNodeId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"txt" | "json">("txt");
  const [importContent, setImportContent] = useState("");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] =
    useState<ImageUrlImportResponse | null>(null);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const pendingFilesCount = fileStates.filter((fs) => fs.status === "pending").length;
  const failedFilesCount = fileStates.filter((fs) => fs.status === "failed").length;

  const createFileState = (file: File): FileUploadState => {
    const previewUrl = typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : undefined;

    if (previewUrl) {
      previewUrlsRef.current.add(previewUrl);
    }

    return {
      file,
      status: "pending",
      retryCount: 0,
      previewUrl,
    };
  };

  const releasePreview = (previewUrl?: string) => {
    if (!previewUrl || !previewUrlsRef.current.delete(previewUrl)) return;
    URL.revokeObjectURL(previewUrl);
  };

  const getQueueProgress = (fileState: FileUploadState) => {
    if (fileState.status === "success") return 100;
    if (fileState.status === "uploading") return Math.max(8, uploadProgress);
    return 0;
  };

  const getQueueStatusLabel = (fileState: FileUploadState) => {
    if (fileState.status === "success") return t.adminUi.uploadSucceeded;
    if (fileState.status === "failed") return t.adminUi.uploadFailed;
    if (fileState.status === "uploading") return t.adminUi.uploadingStatus;
    return t.adminUi.uploadPending;
  };

  const getFileTypeLabel = (file: File) => {
    const extension = file.name.split(".").pop();
    return extension ? extension.toUpperCase() : file.type.replace("image/", "").toUpperCase();
  };

  useEffect(() => () => {
    previewUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    setManualTargetNodeId((current) => (
      nodes.some((node) => node.id === current) ? current : selectedNodeId
    ));
  }, [nodes, selectedNodeId]);

  // Toast通知
  const { toasts, success, error: showError, removeToast } = useToast();

  useEffect(() => {
    const loadSwarmConfig = async () => {
      try {
        const response = await adminFetch("/api/admin/swarm/config");
        if (!response.ok) return;
        const data = await response.json();
        const strategy = data.data?.config?.uploadStrategy;
        if (strategy === "manual" || strategy === "round-robin" || strategy === "random" || strategy === "available-first") {
          setUploadStrategy(strategy);
        }
      } catch (error) {
        console.error("加载蜂群上传策略失败", error);
      }
    };

    loadSwarmConfig();
  }, [adminFetch]);

  // 获取图床提供商列�?
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await adminFetch("/api/admin/storage/providers");
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
  }, [adminFetch, selectedNodeId, showError, getProvidersFailed, getProvidersFailedMessage]);

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
        e.returnValue = t.adminUi.uploadInProgressLeaveWarning;
        return e.returnValue;
      }
    };

    // 添加事件监听�?
    window.addEventListener("beforeunload", handleBeforeUnload);

    // 清理函数
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploading, fileStates, t.adminUi.uploadInProgressLeaveWarning]);

  // 拦截浏览器后退/前进按钮（popstate 事件�?
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const isUploading =
        uploading || fileStates.some((fs) => fs.status === "uploading");

      if (isUploading) {
        // 弹出确认对话�?
        const confirmLeave = window.confirm(
          t.adminUi.uploadInProgressLeaveWarning
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

    // 仅在上传“开始”的边沿向历史记录添加一个状态，
    // 否则每次进度更新都会 pushState，污染浏览历史
    const isUploadingNow =
      uploading || fileStates.some((fs) => fs.status === "uploading");
    if (isUploadingNow && !wasUploadingRef.current) {
      window.history.pushState(null, "", window.location.pathname);
    }
    wasUploadingRef.current = isUploadingNow;

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [uploading, fileStates, t.adminUi.uploadInProgressLeaveWarning]);

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
          t.adminUi.uploadInProgressLeaveWarning
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
            t.adminUi.uploadInProgressLeaveWarning
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
  }, [uploading, fileStates, t.adminUi.uploadInProgressLeaveWarning]);

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

    const newFileStates = files.map(createFileState);

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

      const newFileStates = files.map(createFileState);

      setFileStates((prev) => [...prev, ...newFileStates]);
    }
  };

  // 记录上一轮是否处于上传中，用于上传开始的边沿检测（避免重复 pushState）
  const wasUploadingRef = useRef(false);

  const removeFile = (index: number) => {
    // 上传批次进行中禁止移除：并发 worker 按批次开始时捕获的下标更新状态，
    // 此时移除任意一行都会让后续进度/结果贴到错误的文件上
    if (fileStates.some((fs) => fs.status === "uploading")) return;

    releasePreview(fileStates[index]?.previewUrl);
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

  const getUploadCandidateNodes = () => {
    const availableNodes = nodes.filter((node) => {
      const status = nodeStatuses[node.id]?.status;
      return status === "online" || status === "degraded";
    });
    return availableNodes.length > 0 ? availableNodes : nodes;
  };

  const resolveTargetNodeId = (fileIndex: number): string => {
    const candidates = getUploadCandidateNodes();
    if (uploadStrategy === "manual") {
      return manualTargetNodeId || selectedNodeId;
    }
    if (candidates.length === 0) {
      return selectedNodeId;
    }
    if (uploadStrategy === "round-robin") {
      return candidates[fileIndex % candidates.length].id;
    }
    if (uploadStrategy === "random") {
      return candidates[Math.floor(Math.random() * candidates.length)].id;
    }
    return candidates[0].id;
  };

  // 限制并发上传的函数
  const uploadWithConcurrencyLimit = async (
    uploadItems: UploadQueueItem[],
    maxConcurrency: number = UPLOAD_CONCURRENCY_LIMIT
  ): Promise<Image[]> => {
    if (uploadItems.length === 0) return [];

    const successfulResults: Image[] = [];
    const errors: string[] = [];
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
      const targetNodeId = resolveTargetNodeId(fileIndex);

      try {
        const response = await fetchNode(targetNodeId, "/api/admin/images", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();

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
              })，${retryDelay}ms后重试（第${retryCount + 1}次重试）`
            );

            await delay(retryDelay);
            return uploadSingleFile(fileState, fileIndex, retryCount + 1);
          } else {
            // 获取错误详情
            let errorMessage = t.adminImages.uploadFileFailedWithStatus
              .replace('{name}', file.name)
              .replace('{status}', String(response.status));
            try {
              const errorData = await response.json();
              if (errorData.error?.message) {
                errorMessage = t.adminImages.uploadFileFailed
                  .replace('{name}', file.name)
                  .replace('{message}', errorData.error.message);
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
            `上传 ${file.name} 网络错误，${retryDelay}ms后重试（第${
              retryCount + 1
            }次重试）：`,
            error
          );

          await delay(retryDelay);
          return uploadSingleFile(fileState, fileIndex, retryCount + 1);
        } else {
          const errorMessage = t.adminImages.uploadFileFailed
            .replace('{name}', file.name)
            .replace('{message}', error instanceof Error ? error.message : t.adminLogin.networkError);

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
    const workerCount = Math.min(maxConcurrency, uploadItems.length);
    let currentIndex = 0;

    const processFile = async (): Promise<void> => {
      while (currentIndex < uploadItems.length) {
        const uploadItem = uploadItems[currentIndex++];
        const { fileState, index: realIndex } = uploadItem;

        // 更新为上传中状态
        updateFileState(realIndex, { status: "uploading" });

        try {
          const result = await uploadSingleFile(fileState, realIndex);
          successfulResults.push(result);
        } catch (error) {
          // 即使单个文件失败，也继续处理其他文件
          console.error(`文件 ${fileState.file.name} 上传失败:`, error);
          errors.push(error instanceof Error ? error.message : t.adminUi.uploadFailed);
        } finally {
          completedCount++;
          setUploadProgress((completedCount / uploadItems.length) * 100);
        }
      }
    };

    // 启动并发上传
    await Promise.all(Array.from({ length: workerCount }, () => processFile()));

    // 如果有错误但也有成功的上传，显示部分成功的消息
    if (errors.length > 0 && successfulResults.length > 0) {
      console.warn("部分文件上传失败:", errors);
    } else if (errors.length > 0) {
      throw new Error(
        t.adminImages.allFilesUploadFailed.replace('{errors}', errors.join(', '))
      );
    }

    return successfulResults;
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
      const uploadedImages = await uploadWithConcurrencyLimit([{ fileState, index }], 1);
      uploadedImages.forEach((image: Image) => onUploadSuccess?.(image));
      success(t.adminImages.retrySuccess, t.adminImages.retrySuccessMessage.replace('{name}', fileState.file.name), 3000);
    } catch (error) {
      showError(
        t.adminUi.retryFailed,
        error instanceof Error ? error.message : t.adminUi.unknownError,
        4000
      );
    }
  };

  // 重试所有失败的文件
  const retryAllFailed = async () => {
    const failedItems = fileStates
      .map((fs, idx) => ({ fileState: fs, index: idx }))
      .filter(({ fileState }) => fileState.status === "failed");
    if (failedItems.length === 0) return;

    setCurrentBatchTotal(failedItems.length);
    setUploading(true);
    setUploadProgress(0);

    let uploadedImages: Image[] = [];

    try {
      // 更新所有失败文件的状态
      failedItems.forEach(({ fileState, index }) => {
        updateFileState(index, {
          status: "uploading",
          error: undefined,
          retryCount: fileState.retryCount + 1,
        });
      });

      uploadedImages = await uploadWithConcurrencyLimit(
        failedItems,
        UPLOAD_CONCURRENCY_LIMIT
      );
      uploadedImages.forEach((image: Image) => onUploadSuccess?.(image));

      const retrySuccessCount = uploadedImages.length;
      const retryFailCount = failedItems.length - retrySuccessCount;

      if (retryFailCount > 0) {
        showError(
          t.adminUi.partialRetryFailed,
          t.adminUi.retrySummary
            .replace('{success}', String(retrySuccessCount))
            .replace('{failed}', String(retryFailCount)),
          6000
        );
      } else {
        success(t.adminImages.retryAllSuccess, t.adminImages.retryAllSuccessMessage.replace('{count}', String(retrySuccessCount)), 4000);
      }
    } catch (error) {
      console.error("重试失败:", error);
      const retrySuccessCount = uploadedImages.length;
      const retryFailCount = Math.max(failedItems.length - retrySuccessCount, 0);

      showError(
        t.adminUi.retryFailed,
        retrySuccessCount > 0
          ? t.adminUi.retrySummary
            .replace('{success}', String(retrySuccessCount))
            .replace('{failed}', String(retryFailCount))
          : error instanceof Error ? error.message : t.adminUi.unknownError,
        6000
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentBatchTotal(0);
    }
  };

  // 清除所有成功的文件
  const clearSuccessful = () => {
    fileStates
      .filter((fileState) => fileState.status === "success")
      .forEach((fileState) => releasePreview(fileState.previewUrl));
    setFileStates((prev) => prev.filter((fs) => fs.status !== "success"));
  };

  // 清除所有文件
  const clearAll = () => {
    fileStates.forEach((fileState) => releasePreview(fileState.previewUrl));
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

      const response = await adminFetch("/api/admin/images/import-urls", {
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

      uploadedImages = await uploadWithConcurrencyLimit(
        pendingIndices.map(({ fs, idx }) => ({ fileState: fs, index: idx })),
        UPLOAD_CONCURRENCY_LIMIT
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
          t.adminImages.uploadPartialFailed,
          error instanceof Error ? error.message : t.adminUi.unknownError,
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
      <div className="admin-upload-root">
        <div className="admin-upload-workspace">
        {/* Drag & Drop Zone */}
        <div
          className={cn(
            "admin-upload-dropzone border-2 border-dashed p-4 text-center transition-colors rounded-lg",
            selectedProvider === "custom" ? "is-url-import" : "is-file-upload",
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
                  <span className="uploadArtwork uploadArtworkImage" aria-hidden="true" />
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
                    <span className="uploadArtwork uploadArtworkCloud" aria-hidden="true" />
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
                      ? t.adminImages.urlImportTxtExampleContent
                      : t.adminImages.urlImportJsonExampleContent}
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
                  <span className="uploadArtwork uploadArtworkCloud" aria-hidden="true" />
                </div>
                <div>
                  <p className={cn(
                    "text-sm font-medium mb-1 rounded-lg",
                    isLight ? "text-gray-900" : "text-gray-100"
                  )}>
                    {t.adminUi.dropImagesHere}
                  </p>
                  <p className={cn(
                    "text-xs rounded-lg",
                    isLight ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t.adminUi.dragOrChoose}
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
                  <span>{t.adminUi.chooseFiles}</span>
                  <span className="uploadArtwork uploadArtworkHeart" aria-hidden="true" />
                </button>
                <div className="admin-upload-format-chips" aria-label={t.adminUi.supportedFormats}>
                  <span>PNG ❀</span>
                  <span>JPG ❀</span>
                  <span>WebP ❀</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="admin-upload-settings">
        <h2 className="admin-upload-settings-title">
          <span aria-hidden>❀</span>
          {t.adminUi.uploadSettings}
          <span aria-hidden>❀</span>
        </h2>

        {/* Swarm Upload Strategy */}
          {nodes.length > 0 && selectedProvider !== "custom" && (
            <details className="admin-upload-advanced-options">
            <summary>
              <span className="uploadArtwork uploadArtworkSettings" aria-hidden="true" />
              <span>{t.adminUi.advancedUploadOptions}</span>
              <span className="uploadAdvancedChevron" aria-hidden="true" />
            </summary>
            <div className="admin-upload-advanced-content">
              <div className="admin-upload-swarm">
                <label>
                  <span>{t.adminUi.uploadStrategy}</span>
                  <select
                    value={uploadStrategy}
                    onChange={(e) => setUploadStrategy(e.target.value as UploadStrategy)}
                    disabled={uploading}
                  >
                    <option value="manual">{t.adminUi.manualTargetNode}</option>
                    <option value="round-robin">{t.adminUi.roundRobinNodes}</option>
                    <option value="random">{t.adminUi.randomAvailableNode}</option>
                    <option value="available-first">{t.adminUi.firstAvailableNode}</option>
                  </select>
                </label>

                <label>
                  <span>{uploadStrategy === "manual" ? t.adminUi.targetOwnerNode : t.adminUi.availableNodes}</span>
                  {uploadStrategy === "manual" ? (
                    <select
                      value={manualTargetNodeId}
                      onChange={(e) => setManualTargetNodeId(e.target.value)}
                      disabled={uploading}
                    >
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {getNodeDisplayName(node, t.adminUi.currentNode)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <output>
                      {getUploadCandidateNodes().map((node) => getNodeDisplayName(node, t.adminUi.currentNode)).join("、") || t.adminUi.noAvailableNodes}
                    </output>
                  )}
                  <small>{t.adminUi.targetOwnerHint}</small>
                </label>
              </div>
            </div>
          </details>
        )}

        {/* Provider Selection */}
        {providers.length > 1 && (
          <div className="admin-upload-provider space-y-2">
            <label className={cn(
              "block text-sm font-medium rounded-lg",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminUi.storageProvider} ❀
            </label>
            <div className="admin-upload-provider-options">
              {providers.map((provider) => (
                <button
                  type="button"
                  key={provider.id}
                  disabled={!provider.isAvailable}
                  aria-pressed={selectedProvider === provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <span aria-hidden>{selectedProvider === provider.id ? "◉" : "○"}</span>
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Group and Tags */}
        <div className="admin-upload-fields grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg">
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium rounded-lg",
              isLight ? "text-gray-700" : "text-gray-300"
            )}>
              {t.adminImages.filterByGroup} ❀
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
              <option value="">{t.adminUi.defaultGroup}</option>
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
              {t.adminImages.tagsOptional} ❀
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t.adminUi.addTags}
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
          <div className="admin-upload-submit flex justify-center">
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
                  <span className="uploadArtwork uploadArtworkRefresh animate-spin" aria-hidden="true" />
                  {t.adminImages.uploadCount.replace(
                    "{count}",
                    String(currentBatchTotal || pendingFilesCount)
                  )}
                </div>
              ) : (
                <>{t.adminUi.startUpload} <span aria-hidden>❀</span></>
              )}
            </button>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="admin-upload-progress">
            <div
              className="admin-upload-total-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(uploadProgress)}
              aria-label={t.adminUi.uploadingStatus}
            >
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
            <p>
              <span>{t.adminUi.uploadingStatus}</span>
              <strong>{Math.round(uploadProgress)}%</strong>
            </p>
          </div>
        )}
        </div>
        </div>

        <section className="admin-upload-queue-panel">
          <div className="admin-upload-queue-header">
            <strong><span aria-hidden>❀</span> {t.adminUi.uploadQueue} ({fileStates.length})</strong>
            {fileStates.length > 0 ? (
            <div className="admin-upload-queue-actions flex flex-wrap justify-end gap-2">
            {failedFilesCount > 0 && (
              <button
                type="button"
                onClick={retryAllFailed}
                disabled={uploading}
                className={cn(
                  "text-xs px-2 py-1 border rounded-lg flex items-center gap-1 transition-colors",
                  isLight
                    ? "bg-white border-gray-300 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
                    : "bg-gray-800 border-gray-600 text-blue-400 hover:bg-blue-900/20 hover:border-blue-800",
                  uploading && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className={cn("uploadArtwork uploadArtworkRefresh", uploading && "animate-spin")} aria-hidden="true" />
                {t.adminImages.retryAllFailed.replace("{count}", String(failedFilesCount))}
              </button>
            )}
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
                <span className="uploadArtwork uploadArtworkTrash" aria-hidden="true" />
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
              <span className="uploadArtwork uploadArtworkTrash" aria-hidden="true" />
              {t.adminImages.clearAll}
            </button>
            </div>
            ) : null}
          </div>

        {/* File List */}
        {fileStates.length > 0 ? (
          <div className="admin-upload-queue space-y-1 max-h-96 overflow-y-auto rounded-lg">
            {fileStates.map((fileState, index) => {
              const queueProgress = getQueueProgress(fileState);

              return (
                <article
                  key={`${fileState.file.name}-${fileState.file.lastModified}-${index}`}
                  className={cn("admin-upload-queue-item", `is-${fileState.status}`)}
                >
                  <div className="admin-upload-queue-thumbnail" aria-hidden="true">
                    {fileState.previewUrl ? (
                      // Object URLs are generated from the user's local files, so Next/Image cannot optimize them.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileState.previewUrl} alt="" />
                    ) : (
                      <span className="uploadArtwork uploadArtworkImage" aria-hidden="true" />
                    )}
                  </div>
                  <div className="admin-upload-queue-body">
                    <div className="admin-upload-queue-file-row">
                      <p title={fileState.file.name}>{fileState.file.name}</p>
                      <div className="admin-upload-queue-item-actions">
                        {fileState.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => retryFile(index)}
                            disabled={uploading}
                            className="admin-upload-queue-retry"
                            title={t.adminImages.retry}
                            aria-label={t.adminImages.retry}
                          >
                            <span className={cn("uploadArtwork uploadArtworkRefresh", uploading && "animate-spin")} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          disabled={fileState.status === "uploading"}
                          className="admin-upload-queue-remove"
                          title={t.adminImages.remove}
                          aria-label={t.adminImages.remove}
                        >
                          <span className="uploadArtwork uploadArtworkClose" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="admin-upload-queue-meta">
                      {formatFileSize(fileState.file.size)} <span aria-hidden="true">·</span> {getFileTypeLabel(fileState.file)}
                    </p>
                    <div
                      className="admin-upload-queue-progress-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(queueProgress)}
                      aria-label={`${fileState.file.name} ${getQueueStatusLabel(fileState)}`}
                    >
                      <span style={{ width: `${queueProgress}%` }} />
                    </div>
                    <div className="admin-upload-queue-status-row">
                      <span>{getQueueStatusLabel(fileState)}</span>
                      <strong>{Math.round(queueProgress)}%</strong>
                    </div>
                    {fileState.error && (
                      <p className="admin-upload-queue-error" title={fileState.error}>
                        {fileState.error}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-upload-queue-empty">
            {t.adminUi.chooseImagesForQueue}
          </div>
        )}
        </section>

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
