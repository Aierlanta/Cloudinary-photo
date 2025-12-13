/**
 * API配置管理端点
 * GET /api/admin/config - 获取API参数配置
 * PUT /api/admin/config - 更新API参数配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database';
import { withAdminAuth } from '@/lib/auth';
import { withSecurity } from '@/lib/security';
import { AppError, ErrorType } from '@/types/errors';
import { APIConfigUpdateRequestSchema } from '@/types/schemas';
import { StorageProvider } from '@/lib/storage/base';
import {
  APIResponse,
  APIConfigResponse
} from '@/types/api';

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/config
 * 获取当前API配置
 */
async function getAPIConfig(request: NextRequest): Promise<Response> {
  // 获取API配置
  let config = await databaseService.getAPIConfig();
    
    // 如果配置不存在，创建默认配置
    if (!config) {
      config = {
        id: 'default',
        isEnabled: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [],
        enableDirectResponse: false,
        apiKeyEnabled: false,
        apiKey: undefined,
        updatedAt: new Date()
      };
      await databaseService.updateAPIConfig(config);
    }
    
    // 获取可用的分组列表（用于前端显示）
    const groups = await databaseService.getGroups();
    
    // 构建公开API的访问信息
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.REPLIT_URL || 'http://localhost:3000';
    
    const apiInfo = {
      baseUrl: `${baseUrl}/api/random`,
      examples: generateAPIExamples(baseUrl, config),
      availableGroups: groups.map(group => ({
        id: group.id,
        name: group.name,
        imageCount: group.imageCount
      }))
    };
    
    const response: APIResponse<APIConfigResponse & { apiInfo: typeof apiInfo }> = {
      success: true,
      data: { 
        config,
        apiInfo
      },
      timestamp: new Date()
    };
    
    return NextResponse.json(response);
}

// 应用安全中间件和认证
export const GET = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['GET']
})(withAdminAuth(getAPIConfig));

/**
 * PUT /api/admin/config
 * 更新API配置
 */
async function updateAPIConfig(request: NextRequest): Promise<Response> {
  try {
    // 解析请求体
    const body = await request.json();
    console.log('收到的请求数据:', JSON.stringify(body, null, 2));

    // 验证请求参数
    const validatedData = APIConfigUpdateRequestSchema.parse(body);
    console.log('验证通过的数据:', JSON.stringify(validatedData, null, 2));
    
    // 获取当前配置
    let currentConfig = await databaseService.getAPIConfig();
    if (!currentConfig) {
      // 如果配置不存在，创建默认配置
      currentConfig = {
        id: 'default',
        isEnabled: true,
        defaultScope: 'all',
        defaultGroups: [],
        allowedParameters: [],
        enableDirectResponse: false,
        apiKeyEnabled: false,
        apiKey: undefined,
        updatedAt: new Date()
      };
    }
    
    // 验证分组ID是否存在
    if (validatedData.defaultGroups && validatedData.defaultGroups.length > 0) {
      const groups = await databaseService.getGroups();
      const groupIds = groups.map(g => g.id);
      
      for (const groupId of validatedData.defaultGroups) {
        if (!groupIds.includes(groupId)) {
          throw new AppError(
            ErrorType.VALIDATION_ERROR,
            `分组 ${groupId} 不存在`,
            400
          );
        }
      }
    }
    
    // 验证参数配置中的映射
    if (validatedData.allowedParameters) {
      const groups = await databaseService.getGroups();
      const groupIds = groups.map(g => g.id);
      const providerSet = new Set<string>(Object.values(StorageProvider));

      for (const param of validatedData.allowedParameters) {
        if (param.type === 'provider') {
          const providers = (param as any).mappedProviders as string[] | undefined;
          if (!providers || providers.length === 0) {
            throw new AppError(
              ErrorType.VALIDATION_ERROR,
              `参数 "${param.name}" 必须至少映射一个图床服务`,
              400
            );
          }
          for (const p of providers) {
            if (!providerSet.has(p)) {
              throw new AppError(
                ErrorType.VALIDATION_ERROR,
                `参数 "${param.name}" 中的图床服务 ${p} 不支持`,
                400
              );
            }
          }
          continue;
        }

        // 其他参数类型：校验分组ID
        for (const groupId of param.mappedGroups || []) {
          if (!groupIds.includes(groupId)) {
            throw new AppError(
              ErrorType.VALIDATION_ERROR,
              `参数 "${param.name}" 中的分组 ${groupId} 不存在`,
              400
            );
          }
        }
      }
    }
    
    // 合并配置
    const updatedConfig = {
      ...currentConfig,
      ...validatedData,
      updatedAt: new Date()
    };
    
    // 保存配置
    await databaseService.updateAPIConfig(updatedConfig);
    
    const response: APIResponse<APIConfigResponse> = {
      success: true,
      data: { config: updatedConfig },
      message: 'API配置更新成功',
      timestamp: new Date()
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('API配置更新失败:', error);

    // AppError：按真实状态码返回（否则前端/测试会误判为 500）
    if (error instanceof AppError) {
      return NextResponse.json({
        success: false,
        error: {
          type: error.type,
          message: error.message,
          timestamp: new Date(),
        },
      }, { status: error.statusCode });
    }

    // 如果是Zod验证错误，返回详细的错误信息
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as any;
      console.error('验证错误详情:', zodError.issues);
      return NextResponse.json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: '数据验证失败',
          details: zodError.issues,
          timestamp: new Date()
        }
      }, { status: 400 });
    }

    // 其他错误
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

// 应用安全中间件和认证
export const PUT = withSecurity({
  rateLimit: 'admin',
  allowedMethods: ['PUT'],
  allowedContentTypes: ['application/json'],
  maxRequestSize: 1024 * 1024 // 1MB
})(withAdminAuth(updateAPIConfig));

/**
 * 生成API使用示例
 */
function generateAPIExamples(baseUrl: string, config: any) {
  const examples = [];
  
  // 基础示例
  examples.push({
    title: '获取随机图片',
    url: `${baseUrl}/api/random`,
    description: '获取一张随机图片'
  });
  
  // 参数示例
  if (config.allowedParameters && config.allowedParameters.length > 0) {
    for (const param of config.allowedParameters) {
      if (param.isEnabled && param.allowedValues.length > 0) {
        const exampleValue = param.allowedValues[0];
        examples.push({
          title: `按${param.name}筛选`,
          url: `${baseUrl}/api/random?${param.name}=${exampleValue}`,
          description: `获取${param.name}为"${exampleValue}"的随机图片`
        });
      }
    }
  }
  
  // 组合参数示例
  if (config.allowedParameters && config.allowedParameters.length > 1) {
    const enabledParams = config.allowedParameters.filter((p: any) => p.isEnabled && p.allowedValues.length > 0);
    if (enabledParams.length >= 2) {
      const param1 = enabledParams[0];
      const param2 = enabledParams[1];
      const queryString = `${param1.name}=${param1.allowedValues[0]}&${param2.name}=${param2.allowedValues[0]}`;
      examples.push({
        title: '组合参数筛选',
        url: `${baseUrl}/api/random?${queryString}`,
        description: '使用多个参数组合筛选图片'
      });
    }
  }
  
  return examples;
}