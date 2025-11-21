/**
 * 多图床上传组件
 * 支持同时上传到多个图床服务，并显示详细的上传状态
 */

'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Cloud, 
  Database,
  X,
  FileImage
} from 'lucide-react';

interface UploadResult {
  success: boolean;
  provider: string;
  failedOver: boolean;
  hasBackup: boolean;
  uploadTime: number;
  retryCount: number;
  image?: {
    id: string;
    url: string;
    primaryProvider: string;
    backupProvider?: string;
    storageRecords: Array<{
      provider: string;
      url: string;
      status: string;
    }>;
  };
  error?: string;
}

interface MultiStorageUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
}

export default function MultiStorageUpload({ 
  onUploadComplete, 
  onUploadError 
}: MultiStorageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, success, error: showError, removeToast } = useToast();

  // 处理文件选择
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    uploadFile(file);
  };

  // 上传文件
  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件');
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('文件大小不能超过 10MB');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/images/multi-storage', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const uploadResult: UploadResult = {
          success: true,
          provider: result.data.metadata.provider,
          failedOver: result.data.metadata.failedOver,
          hasBackup: result.data.metadata.hasBackup,
          uploadTime: result.data.metadata.uploadTime,
          retryCount: result.data.metadata.retryCount,
          image: result.data.image
        };
        
        setUploadResult(uploadResult);
        onUploadComplete?.(uploadResult);
      } else {
        throw new Error(result.message || '上传失败');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '上传失败';
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // 清除结果
  const clearResult = () => {
    setUploadResult(null);
    setError(null);
  };

  return (
    <>
    <div className="space-y-4">
      {/* 上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            多图床上传
          </CardTitle>
          <CardDescription>
            支持自动故障转移和备份上传的智能图床服务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-300'}
              ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
              disabled={uploading}
            />
            
            {uploading ? (
              <div className="space-y-2">
                <Clock className="h-8 w-8 mx-auto animate-spin text-primary" />
                <p className="text-lg font-medium">正在上传...</p>
                <p className="text-sm text-muted-foreground">
                  正在使用多图床服务上传，请稍候
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <FileImage className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-lg font-medium">点击或拖拽上传图片</p>
                <p className="text-sm text-muted-foreground">
                  支持 JPG、PNG、GIF 等格式，最大 10MB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 错误信息 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearResult}>
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 上传结果 */}
      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                上传成功
              </div>
              <Button variant="ghost" size="sm" onClick={clearResult}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">主要存储</p>
                <div className="flex items-center mt-1">
                  <Cloud className="h-4 w-4 mr-2" />
                  <span className="font-medium">{uploadResult.provider}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">上传时间</p>
                <p className="font-medium">{uploadResult.uploadTime}ms</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">重试次数</p>
                <p className="font-medium">{uploadResult.retryCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">状态</p>
                <div className="flex space-x-1 mt-1">
                  {uploadResult.failedOver && (
                    <Badge variant="secondary">故障转移</Badge>
                  )}
                  {uploadResult.hasBackup && (
                    <Badge variant="outline">有备份</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* 存储记录 */}
            {uploadResult.image?.storageRecords && (
              <div>
                <h4 className="font-medium mb-2">存储记录</h4>
                <div className="space-y-2">
                  {uploadResult.image.storageRecords.map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center">
                        {record.provider === 'cloudinary' ? (
                          <Cloud className="h-4 w-4 mr-2" />
                        ) : (
                          <Database className="h-4 w-4 mr-2" />
                        )}
                        <div>
                          <p className="font-medium">{record.provider}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {record.url}
                          </p>
                        </div>
                      </div>
                      <Badge variant={record.status === 'active' ? 'default' : 'secondary'}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 图片预览 */}
            {uploadResult.image?.url && (
              <div>
                <h4 className="font-medium mb-2">图片预览</h4>
                <div className="border rounded-lg p-4">
                  <img
                    src={uploadResult.image.url}
                    alt="上传的图片"
                    className="max-w-full max-h-64 mx-auto rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="mt-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      图片ID: {uploadResult.image.id}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(uploadResult.image!.url);
                          success('复制成功', 'URL 已复制到剪贴板');
                        } catch (err) {
                          showError('复制失败', err instanceof Error ? err.message : '无法复制 URL');
                        }
                      }}
                    >
                      复制 URL
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    <ToastContainer toasts={toasts.map((toast) => ({ ...toast, onClose: removeToast }))} />
    </>
  );
}
