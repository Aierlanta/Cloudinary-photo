/**
 * 蜂群配置管理端点
 * GET /api/admin/swarm/config - 获取蜂群共享配置
 * PUT /api/admin/swarm/config - 更新蜂群共享配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { SwarmConfigUpdateRequestSchema } from '@/types/schemas';
import { APIResponse, SwarmConfigResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

async function getSwarmConfig(_request: NextRequest): Promise<Response> {
  const config = await databaseService.getOrCreateSwarmConfig();
  const response: APIResponse<SwarmConfigResponse> = {
    success: true,
    data: { config },
    timestamp: new Date()
  };

  return NextResponse.json(response);
}

async function updateSwarmConfig(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const validatedData = SwarmConfigUpdateRequestSchema.parse(body);
    const currentConfig = await databaseService.getOrCreateSwarmConfig();

    const updatedConfig = {
      ...currentConfig,
      ...validatedData,
      providerDeliveryPolicy: {
        ...currentConfig.providerDeliveryPolicy,
        ...(validatedData.providerDeliveryPolicy || {})
      },
      updatedAt: new Date()
    };

    await databaseService.updateSwarmConfig(updatedConfig);
    const savedConfig = await databaseService.getOrCreateSwarmConfig();

    const response: APIResponse<SwarmConfigResponse> = {
      success: true,
      data: { config: savedConfig },
      message: '蜂群配置更新成功',
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: '蜂群配置验证失败',
          details: (error as any).issues,
          timestamp: new Date()
        }
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : '服务器内部错误',
        timestamp: new Date()
      }
    }, { status: 500 });
  }
}

export const GET = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['GET']
})(withAdminAuth(getSwarmConfig));

export const PUT = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['PUT'],
  allowedContentTypes: ['application/json']
})(withAdminAuth(updateSwarmConfig));
