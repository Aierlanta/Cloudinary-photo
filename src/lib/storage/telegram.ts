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
import { buildFetchInitFor } from '@/lib/telegram-proxy';

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
  private readonly botInfoCacheTtl = 5 * 60 * 1000;
  private readonly filePathRetryLimit = 3;
  private readonly retryDelayBase = 800;
  private botInfoCache: Map<string, { expiresAt: number; info: { id: number; username: string } }> = new Map();
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
    let botInfo: { id: number; username: string } | undefined;

    try {
      // 获取 chat_id
      let chatId = this.chatId;
      if (!chatId) {
        botInfo = await this.getBotInfo(token);
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
      const response = await fetch(
        uploadUrl,
        buildFetchInitFor(uploadUrl, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(this.timeout)
        } as RequestInit)
      );

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
      const { filePath, thumbnailPath } = await this.resolveFilePaths(token, document);
      const guessedBotId = botInfo?.id ?? this.extractBotIdFromToken(token);
      const finalUrl = filePath
        ? this.buildFileUrl(token, filePath)
        : this.buildProxyUrl(document.file_id, guessedBotId);

      // 构建返回结果
      const storageResult: StorageResult = {
        id: document.file_id,
        publicId: document.file_id,
        // 使用 Telegram 原始 URL (包含 bot token)
        // 这个 URL 只能通过 /api/response 访问,不会通过 /api/random 暴露
        url: finalUrl,
        filename: file.name,
        format: this.extractFormat(file.name),
        bytes: file.size,
        metadata: {
          provider: StorageProvider.TELEGRAM,
          uploadTime: new Date().toISOString(),
          responseTime,
          // 存储 bot token 用于后续访问
          telegramBotToken: token,
          telegramFileId: document.file_id,
          telegramFilePath: filePath,
          telegramThumbnailFileId: document.thumbnail?.file_id,
          telegramThumbnailPath: thumbnailPath,
          telegramBotId: guessedBotId,
          downloadStrategy: filePath ? 'direct' : 'proxy',
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
    const cached = this.botInfoCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.info;
    }

    const url = `https://api.telegram.org/bot${token}/getMe`;
    const response = await fetch(
      url,
      buildFetchInitFor(url, {
        signal: AbortSignal.timeout(this.timeout)
      } as RequestInit)
    );
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
    const info = result.result;
    this.botInfoCache.set(token, { expiresAt: Date.now() + this.botInfoCacheTtl, info });
    return info;
  }

  /**
   * 获取文件路径（带重试）
   */
  private async getFilePath(token: string, fileId: string, attempt = 0): Promise<string> {
    const url = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
    try {
      const response = await fetch(
        url,
        buildFetchInitFor(url, { signal: AbortSignal.timeout(this.timeout) } as RequestInit)
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
    } catch (err) {
      const error = err instanceof StorageError
        ? err
        : new StorageError(
            `获取文件路径网络异常: ${err instanceof Error ? err.message : '未知错误'}`,
            StorageProvider.TELEGRAM,
            'TELEGRAM_NETWORK_ERROR',
            { error: err }
          );

      if (this.shouldRetry(error) && attempt + 1 < this.filePathRetryLimit) {
        await this.delay((attempt + 1) * this.retryDelayBase);
        return this.getFilePath(token, fileId, attempt + 1);
      }

      throw error;
    }
  }

  private shouldRetry(error: StorageError): boolean {
    const status = error.details?.status;
    if (status === 429 || (typeof status === 'number' && status >= 500)) {
      return true;
    }
    return error.code === 'TELEGRAM_NETWORK_ERROR' || error.message.includes('timeout');
  }

  private async resolveFilePaths(
    token: string,
    document: NonNullable<TelegramUploadResponse['result']>['document']
  ): Promise<{ filePath?: string; thumbnailPath?: string }> {
    const mainPromise = this.getFilePath(token, document.file_id);
    const thumbPromise = document.thumbnail
      ? this.getFilePath(token, document.thumbnail.file_id)
          .catch(error => {
            console.warn(`[Telegram 上传] 缩略图路径获取失败: ${document.thumbnail?.file_id}`, error);
            return undefined;
          })
      : Promise.resolve<string | undefined>(undefined);

    let filePath: string | undefined;
    try {
      filePath = await mainPromise;
    } catch (error) {
      console.warn(`[Telegram 上传] 主文件路径获取失败, 将使用代理 URL 回退: ${document.file_id}`, error);
    }

    const thumbnailPath = await thumbPromise;

    return { filePath, thumbnailPath };
  }

  /**
   * 构建文件访问 URL
   */
  private buildFileUrl(token: string, filePath: string): string {
    return `https://api.telegram.org/file/bot${token}/${filePath}`;
  }

  private buildProxyUrl(fileId: string, botId?: number): string {
    const params = new URLSearchParams({ file_id: fileId });
    if (botId) {
      params.set('bot_id', botId.toString());
    }
    return `/api/telegram/image?${params.toString()}`;
  }

  private extractBotIdFromToken(token: string): number | undefined {
    const prefix = token.split(':')[0];
    if (/^\d+$/.test(prefix)) {
      return Number(prefix);
    }
    return undefined;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      const url = `https://api.telegram.org/bot${token}/getMe`;
      const response = await fetch(
        url,
        buildFetchInitFor(url, { signal: AbortSignal.timeout(this.timeout) } as RequestInit)
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
      const url = `https://api.telegram.org/bot${token}/getMe`;
      const response = await fetch(
        url,
        buildFetchInitFor(url, { signal: AbortSignal.timeout(this.timeout) } as RequestInit)
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

