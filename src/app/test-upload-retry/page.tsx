'use client';

import { useState } from 'react';
import ImageUpload from '@/components/admin/ImageUpload';

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

export default function TestUploadRetryPage() {
  const [uploadedImages, setUploadedImages] = useState<Image[]>([]);

  const handleUploadSuccess = (image?: Image) => {
    if (!image) return;
    setUploadedImages(prev => [...prev, image]);
    console.log('上传成功:', image);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">上传失败重试功能测试</h1>
      
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">功能说明</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>✅ 每个文件都有独立的状态（等待、上传中、成功、失败）</li>
          <li>✅ 上传失败的文件会保留在列表中</li>
          <li>✅ 可以针对单个失败文件点击"重试"按钮</li>
          <li>✅ 可以批量重试所有失败的文件</li>
          <li>✅ 显示详细的错误信息和重试次数</li>
          <li>✅ 成功的文件可以单独清除或保留</li>
        </ul>
      </div>

      <div className="mb-6">
        <ImageUpload
          groups={[]}
          onUploadSuccess={handleUploadSuccess}
        />
      </div>

      {uploadedImages.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">
            已上传图片 ({uploadedImages.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {uploadedImages.map((image) => (
              <div key={image.id} className="border rounded-lg p-2">
                <img
                  src={image.url}
                  alt={image.filename}
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <p className="text-xs truncate">{image.filename}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
