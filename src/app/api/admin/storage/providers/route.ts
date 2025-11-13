/**
 * 图床服务提供商API端点
 * GET /api/admin/storage/providers - 获取可用的图床服务提供商列表
 */

import { NextRequest, NextResponse } from 'next/server';


// 图床开关（默认启用，设置为 'false' 以禁用）
const CLOUDINARY_ENABLED = process.env.CLOUDINARY_ENABLE !== 'false';
const TGSTATE_ENABLED = process.env.TGSTATE_ENABLE !== 'false';

interface StorageProviderInfo {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  features: string[];
}

/**
 * GET /api/admin/storage/providers
 * 获取可用的图床服务提供商列表
 */
export async function GET(request: NextRequest): Promise<Response> {
  const providers: StorageProviderInfo[] = [
    {
      id: 'cloudinary',
      name: 'Cloudinary',
      description: '专业的云端图片和视频管理服务',
      isAvailable: CLOUDINARY_ENABLED && !!(process.env.CLOUDINARY_CLOUD_NAME &&
                     process.env.CLOUDINARY_API_KEY &&
                     process.env.CLOUDINARY_API_SECRET),
      features: [
        '图片变换和优化',
        '自动格式转换',
        '智能压缩',
        'CDN加速',
        '高可用性'
      ]
    },
    {
      id: 'tgstate',
      name: 'tgState',
      description: '基于Telegram的免费图床服务',
      isAvailable: TGSTATE_ENABLED && !!process.env.TGSTATE_BASE_URL,
      features: [
        '免费存储',
        '无限容量',
        '快速上传',
        '永久保存',
        '简单易用'
      ]
    }
  ];

  const response = {
    success: true,
    data: {
      providers
    },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}
