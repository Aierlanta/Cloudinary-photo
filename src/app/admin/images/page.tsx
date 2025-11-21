"use client";

import { useState, useEffect } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useLocale } from "@/hooks/useLocale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Upload, Database, Grid } from "lucide-react";

interface Image {
  id: string;
  publicId: string;
  url: string;
  title?: string;
  description?: string;
  groupId?: string;
  uploadedAt: string;
  tags?: string[];
}

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  imageCount: number;
}

export default function ImagesPage() {
  const { t } = useLocale();
  const isLight = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [totalImages, setTotalImages] = useState(0);

  // Toast通知
  const { toasts, removeToast } = useToast();

  // 加载分组列表和总图片数
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await fetch("/api/admin/groups");
        if (response.ok) {
          const data = await response.json();
          const groupsData = data.data?.groups || [];
          setGroups(Array.isArray(groupsData) ? groupsData : []);
        } else {
          console.error("加载分组失败:", response.statusText);
        }
      } catch (error) {
        console.error("加载分组失败:", error);
      }
    };

    const loadTotalImages = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setTotalImages(data.data?.totalImages || 0);
        }
      } catch (error) {
        console.error("加载总图片数失败:", error);
      }
    };

    loadGroups();
    loadTotalImages();
  }, []);

  const handleUploadSuccess = () => {
    // 上传成功后可以刷新统计数据
    const loadTotalImages = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setTotalImages(data.data?.totalImages || 0);
        }
      } catch (error) {
        console.error("加载总图片数失败:", error);
      }
    };
    loadTotalImages();
  };


  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className={cn(
        "border p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <div>
          <h1 className={cn(
            "text-3xl font-bold flex items-center gap-3 mb-2",
            isLight ? "text-gray-900" : "text-gray-100"
          )}>
            <Upload className={cn(
              "w-8 h-8",
              isLight ? "text-blue-500" : "text-blue-400"
            )} />
            {t.adminUpload?.title || "图片上传"}
          </h1>
          <p className={isLight ? "text-gray-600" : "text-gray-400"}>
            {t.adminUpload?.description || "上传和管理您的图片"}
          </p>
        </div>
        <div className={cn(
          "flex flex-wrap items-center gap-6 p-4 border",
          isLight ? "bg-gray-50 border-gray-300" : "bg-gray-700 border-gray-600"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center",
              isLight ? "bg-blue-500" : "bg-blue-600"
            )}>
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-xs",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminImages.totalImages}
              </p>
              <p className={cn(
                "text-xl font-bold",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {totalImages}
              </p>
            </div>
          </div>
          <div className={cn(
            "w-px h-10",
            isLight ? "bg-gray-300" : "bg-gray-600"
          )} />
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center",
              isLight ? "bg-green-500" : "bg-green-600"
            )}>
              <Grid className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={cn(
                "text-xs",
                isLight ? "text-gray-600" : "text-gray-400"
              )}>
                {t.adminImages.groupCount}
              </p>
              <p className={cn(
                "text-xl font-bold",
                isLight ? "text-gray-900" : "text-gray-100"
              )}>
                {groups.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className={cn(
        "border p-6",
        isLight ? "bg-white border-gray-300" : "bg-gray-800 border-gray-600"
      )}>
        <h2 className={cn(
          "text-lg font-semibold mb-4 flex items-center gap-2",
          isLight ? "text-gray-900" : "text-gray-100"
        )}>
          <Database className={cn(
            "w-5 h-5",
            isLight ? "text-blue-500" : "text-blue-400"
          )} />
          {t.adminImages.uploadImage}
        </h2>
        <ImageUpload groups={groups} onUploadSuccess={handleUploadSuccess} />
      </div>

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}
