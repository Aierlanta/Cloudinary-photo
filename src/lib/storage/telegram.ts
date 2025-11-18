/**
 * Telegram Bot API 图床服务适配器
 * 直接使用 Telegram Bot API 进行文件存储
 * 支持多 Bot Token 轮询和 Thumbnail 优化
 */

import {
  ImageStorageService,
  StorageProvider,
  StorageResult,
  UploadOptions,
  HealthStatus,
  StorageStats,
  StorageError
} from './base';
import { Readable } from 'stream';

export interface TelegramConfig {
  botTokens: string[]; // 支持多个 Bot Token
  timeout?: number;
  chatId?: string; // 可选的目标 chat_id,默认使用 bot 自己的存储
}

export interface TelegramUploadResponse {
  ok: boolean;
  result?: {
    message_id: number;
    document: {
      file_name: string;
      mime_type: string;
      file_id: string;
      file_unique_id: string;
      file_size: number;
      thumbnail?: {
        file_id: string;
        file_unique_id: string;
        file_size: number;
        width: number;
        height: number;
      };
      thumb?: any; // 与 thumbnail 相同
    };
  };
  description?: string;
}

export interface TelegramFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
  };
  description?: string;
}

/**
 * Bot Token 管理器
 * 实现轮询和健康检查
 */
class TelegramTokenManager {
  private tokens: string[];
  private currentIndex: number = 0;
  private healthStatus: Map<string, { healthy: boolean; lastCheck: Date }> = new Map();

  constructor(tokens: string[]) {
    if (!tokens || tokens.length === 0) {
      throw new Error('至少需要提供一个 Bot Token');
    }
    this.tokens = tokens;
    // 初始化健康状态
    tokens.forEach(token => {
      this.healthStatus.set(token, { healthy: true, lastCheck: new Date() });
    });
  }

  /**
   * 获取下一个可用的 Token (Round-robin)
   */
  getNextToken(): string {
    const startIndex = this.currentIndex;
    
    // 尝试找到一个健康的 token
    do {
      const token = this.tokens[this.currentIndex];
      const status = this.healthStatus.get(token);
      
      // 移动到下一个索引
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
      
      // 如果 token 健康,返回它
      if (status?.healthy) {
        return token;
      }
    } while (this.currentIndex !== startIndex);
    
    // 如果所有 token 都不健康,返回第一个并重置健康状态
    console.warn('所有 Bot Token 都不健康,重置健康状态');
    this.tokens.forEach(token => {
      this.healthStatus.set(token, { healthy: true, lastCheck: new Date() });
    });
    
    return this.tokens[0];
  }

  /**
   * 标记 Token 为不健康
   */
  markUnhealthy(token: string): void {
    this.healthStatus.set(token, { healthy: false, lastCheck: new Date() });
  }

  /**
   * 标记 Token 为健康
   */
  markHealthy(token: string): void {
    this.healthStatus.set(token, { healthy: true, lastCheck: new Date() });
  }

  /**
   * 获取所有 Token 的健康状态
   */
  getHealthStatus(): Map<string, { healthy: boolean; lastCheck: Date }> {
    return new Map(this.healthStatus);
  }

  /**
   * 获取 Token 数量
   */
  getTokenCount(): number {
    return this.tokens.length;
  }
}

export class TelegramService extends ImageStorageService {
  private tokenManager: TelegramTokenManager;
  private timeout: number;
  private chatId?: string;
  private stats: {
    totalUploads: number;
    successCount: number;
    totalResponseTime: number;
    lastFailure?: Date;
  };

  constructor(config: TelegramConfig) {
    super(StorageProvider.TELEGRAM, config);
    this.tokenManager = new TelegramTokenManager(config.botTokens);
    this.timeout = config.timeout || 30000; // 30秒超时
    this.chatId = config.chatId;
    this.stats = {
      totalUploads: 0,
      successCount: 0,
      totalResponseTime: 0
    };
  }

  /**
   * 上传图片到 Telegram
   */
  async uploadImage(file: File, options?: UploadOptions): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalUploads++;

    const token = this.tokenManager.getNextToken();

    try {
      // 获取 chat_id
      let chatId: string;
      if (this.chatId) {
        chatId = this.chatId;
      } else {
        const botInfo = await this.getBotInfo(token);
        chatId = botInfo.id.toString();
      }

      // 构建上传 URL
      const uploadUrl = `https://api.telegram.org/bot${token}/sendDocument`;

      // 将 File 转换为 Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 创建 FormData (使用 Web API FormData)
      const formData = new FormData();

      // 创建 Blob 并添加到 FormData
      const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
      formData.append('document', blob, file.name);
      formData.append('chat_id', chatId);

      // 发送上传请求
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(this.timeout)
      });

      // HTTP 非 2xx 时，分类处理
      if (!response.ok) {
        const status = response.status;
        const bodyText = await response.text().catch(() => '');
        if (status === 401 || status === 403) {
          throw new StorageError(
            `Telegram 上传未授权/被禁止 (HTTP ${status})`,
            StorageProvider.TELEGRAM,
            status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
            { status, body: bodyText }
          );
        }
        throw new StorageError(
          `Telegram 上传失败 (HTTP ${status})`,
          StorageProvider.TELEGRAM,
          'UPLOAD_FAILED_HTTP',
          { status, body: bodyText }
        );
      }

      const result: TelegramUploadResponse = await response.json();

      if (!result.ok || !result.result) {
        const desc = result.description || '未知错误';
        const lower = desc.toLowerCase();
        const isAuth =
          lower.includes('unauthorized') ||
          lower.includes('forbidden') ||
          lower.includes('invalid token');
        if (isAuth) {
          throw new StorageError(
            `Telegram 上传鉴权失败: ${desc}`,
            StorageProvider.TELEGRAM,
            'UNAUTHORIZED',
            { description: desc }
          );
        }
        throw new StorageError(
          `Telegram 上传失败: ${desc}`,
          StorageProvider.TELEGRAM,
          'UPLOAD_FAILED',
          result
        );
      }

      // 标记 token 为健康
      this.tokenManager.markHealthy(token);

      // 记录成功统计
      const responseTime = Date.now() - startTime;
      this.stats.successCount++;
      this.stats.totalResponseTime += responseTime;

      const document = result.result.document;
      // 获取当前 Bot 信息（用于下游访问时选择正确的 token）
      const currentBotInfo = await this.getBotInfo(token);

      // 获取文件路径
      const filePath = await this.getFilePath(token, document.file_id);
      const thumbnailPath = document.thumbnail
        ? await this.getFilePath(token, document.thumbnail.file_id)
        : undefined;

      // 构建返回结果
      const storageResult: StorageResult = {
        id: document.file_id,
        publicId: document.file_id,
        // 使用内部代理 URL，并携带 bot_id，确保代理端选择正确的 Token
        url: `/api/telegram/image?file_id=${encodeURIComponent(document.file_id)}&bot_id=${encodeURIComponent(
          currentBotInfo.id.toString()
        )}`,
        filename: file.name,
        format: this.extractFormat(file.name),
        bytes: file.size,
        metadata: {
          provider: StorageProvider.TELEGRAM,
          uploadTime: new Date().toISOString(),
          responseTime,
          // 不存储 token,前端会使用环境变量中的 token
          telegramFileId: document.file_id,
          telegramFilePath: filePath,
          telegramThumbnailFileId: document.thumbnail?.file_id,
          telegramThumbnailPath: thumbnailPath,
          telegramBotId: currentBotInfo.id,
          originalResponse: result
        }
      };

      console.log(`Telegram 上传成功: ${storageResult.publicId}`);
      return storageResult;

    } catch (error) {
      this.stats.lastFailure = new Date();
      // 仅在鉴权类错误时标记为不健康，提升可用性
      let shouldMarkUnhealthy = false;
      if (error instanceof StorageError) {
        const status = error.details?.status;
        if (
          error.code === 'UNAUTHORIZED' ||
          error.code === 'FORBIDDEN' ||
          status === 401 ||
          status === 403
        ) {
          shouldMarkUnhealthy = true;
        }
      }
      if (shouldMarkUnhealthy) {
        this.tokenManager.markUnhealthy(token);
      }

      if (error instanceof StorageError) {
        throw error;
      }

      throw new StorageError(
        `Telegram 上传过程中发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        StorageProvider.TELEGRAM,
        'UPLOAD_ERROR',
        { error, filename: file.name }
      );
    }
  }

  /**
   * 获取 Bot 信息
   */
  private async getBotInfo(token: string): Promise<{ id: number; username: string }> {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => '');
      if (status === 401 || status === 403) {
        throw new StorageError(
          `获取 Bot 信息未授权/被禁止 (HTTP ${status})`,
          StorageProvider.TELEGRAM,
          status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          { status, body }
        );
      }
      throw new StorageError(
        `获取 Bot 信息失败 (HTTP ${status})`,
        StorageProvider.TELEGRAM,
        'TELEGRAM_HTTP_ERROR',
        { status, body }
      );
    }
    const result = await response.json();
    if (!result.ok) {
      const desc: string = result.description || '';
      const lower = desc.toLowerCase?.() || '';
      if (lower.includes('unauthorized') || lower.includes('forbidden')) {
        throw new StorageError(
          `获取 Bot 信息鉴权失败: ${desc}`,
          StorageProvider.TELEGRAM,
          'UNAUTHORIZED',
          { description: desc }
        );
      }
      throw new StorageError(
        `获取 Bot 信息失败: ${desc}`,
        StorageProvider.TELEGRAM,
        'TELEGRAM_API_ERROR',
        { description: desc }
      );
    }
    return result.result;
  }

  /**
   * 获取文件路径
   */
  private async getFilePath(token: string, fileId: string): Promise<string> {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => '');
      if (status === 401 || status === 403) {
        throw new StorageError(
          `获取文件路径未授权/被禁止 (HTTP ${status})`,
          StorageProvider.TELEGRAM,
          status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          { status, body }
        );
      }
      throw new StorageError(
        `获取文件路径失败 (HTTP ${status})`,
        StorageProvider.TELEGRAM,
        'TELEGRAM_HTTP_ERROR',
        { status, body }
      );
    }
    const result: TelegramFileResponse = await response.json();
    if (!result.ok || !result.result) {
      const desc: string = result.description || '';
      const lower = desc.toLowerCase?.() || '';
      if (lower.includes('unauthorized') || lower.includes('forbidden')) {
        throw new StorageError(
          `获取文件路径鉴权失败: ${desc}`,
          StorageProvider.TELEGRAM,
          'UNAUTHORIZED',
          { description: desc }
        );
      }
      throw new StorageError(
        `获取文件路径失败: ${desc}`,
        StorageProvider.TELEGRAM,
        'TELEGRAM_API_ERROR',
        { description: desc }
      );
    }
    return result.result.file_path;
  }

  /**
   * 构建文件访问 URL
   */
  private buildFileUrl(token: string, filePath: string): string {
    return `https://api.telegram.org/file/bot${token}/${filePath}`;
  }

  /**
   * 脱敏 Token (只保留前后各4位)
   */
  private maskToken(token: string): string {
    if (token.length <= 8) return '****';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * 从文件名提取格式
   */
  private extractFormat(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
  }

  /**
   * 删除图片 (Telegram 不支持删除)
   */
  async deleteImage(identifier: string): Promise<void> {
    console.warn(`Telegram 不支持删除操作,图片 ${identifier} 将保留`);
  }

  /**
   * 获取图片 URL
   */
  getImageUrl(identifier: string, transformations?: any[]): string {
    if (transformations && transformations.length > 0) {
      console.warn('Telegram 不支持图片变换,将返回原始图片URL');
    }
    
    // identifier 应该是完整的 URL
    return identifier;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const token = this.tokenManager.getNextToken();
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getMe`,
        { signal: AbortSignal.timeout(5000) }
      );

      const result = await response.json();
      const responseTime = Date.now() - startTime;
      const isHealthy = result.ok;

      if (isHealthy) {
        this.tokenManager.markHealthy(token);
      } else {
        this.tokenManager.markUnhealthy(token);
      }

      return {
        isHealthy,
        responseTime,
        lastChecked: new Date(),
        error: isHealthy ? undefined : result.description
      };

    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<StorageStats> {
    return {
      totalUploads: this.stats.totalUploads,
      successRate: this.stats.totalUploads > 0 
        ? this.stats.successCount / this.stats.totalUploads 
        : 0,
      averageResponseTime: this.stats.successCount > 0
        ? this.stats.totalResponseTime / this.stats.successCount
        : 0,
      lastFailure: this.stats.lastFailure
    };
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const token = this.tokenManager.getNextToken();
      const response = await fetch(
        `https://api.telegram.org/bot${token}/getMe`,
        { signal: AbortSignal.timeout(5000) }
      );
      const result = await response.json();
      return result.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取 Token 管理器状态
   */
  getTokenManagerStatus() {
    return {
      tokenCount: this.tokenManager.getTokenCount(),
      healthStatus: Array.from(this.tokenManager.getHealthStatus().entries()).map(
        ([token, status]) => ({
          token: this.maskToken(token),
          healthy: status.healthy,
          lastCheck: status.lastCheck
        })
      )
    };
  }
}

