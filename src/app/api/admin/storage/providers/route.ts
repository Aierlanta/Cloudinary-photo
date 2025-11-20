/**
 * 图床服务提供商API端点
 * GET /api/admin/storage/providers - 获取可用的图床服务提供商列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { isStorageEnabled, StorageProvider } from '@/lib/storage';

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
      isAvailable: isStorageEnabled(StorageProvider.CLOUDINARY) && !!(process.env.CLOUDINARY_CLOUD_NAME &&
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
      description: '基于Telegram的免费图床服务 (第三方)',
      isAvailable: isStorageEnabled(StorageProvider.TGSTATE) && !!process.env.TGSTATE_BASE_URL,
      features: [
        '免费存储',
        '无限容量',
        '快速上传',
        '永久保存',
        '简单易用'
      ]
    },
    {
      id: 'telegram',
      name: 'Telegram 直连',
      description: 'Telegram Bot API 直连 (推荐)',
      isAvailable: isStorageEnabled(StorageProvider.TELEGRAM) && !!(
        process.env.TELEGRAM_BOT_TOKENS || process.env.TELEGRAM_BOT_TOKEN
      ),
      features: [
        '无需第三方服务',
        '多Token负载均衡',
        '自动缩略图优化',
        '健康检查和故障切换',
        '免费无限存储'
      ]
    },
    {
      id: 'custom',
      name: '自定义外链',
      description: '使用自定义URL作为图片来源，不经过任何上传或托管',
      isAvailable: isStorageEnabled(StorageProvider.CUSTOM),
      features: [
        '批量导入URL（txt/json/items）',
        '不依赖第三方存储',
        '保留原始外链地址',
        '与现有缩略图/预览逻辑完全兼容'
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
