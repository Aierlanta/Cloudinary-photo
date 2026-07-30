"use client";

import { useState, useEffect, useCallback } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useAdminApi } from "@/lib/admin-api-client";
import styles from "../admin-pages.module.css";

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  imageCount: number;
}

export default function ImagesPage() {
  const { adminFetch, selectedNodeId } = useAdminApi();
  const [groups, setGroups] = useState<Group[]>([]);
  const { toasts, removeToast } = useToast();

  const loadSummary = useCallback(async () => {
    try {
      const response = await adminFetch("/api/admin/summary");
      if (response.ok) {
        const data = await response.json();
        const groupsData = data.data?.groups || [];
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } else {
        console.error("加载后台概要失败:", response.statusText);
      }
    } catch (error) {
      console.error("加载后台概要失败:", error);
    }
  }, [adminFetch]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, selectedNodeId]);

  const handleUploadSuccess = () => {
    loadSummary();
  };

  return (
    <div className={`${styles.page} admin-upload-page`}>
      <ImageUpload groups={groups} onUploadSuccess={handleUploadSuccess} />

      <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </div>
  );
}
