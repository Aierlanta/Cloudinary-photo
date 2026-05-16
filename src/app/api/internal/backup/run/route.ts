import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { BackupService } from '@/lib/backup';
import { withErrorHandler } from '@/lib/error-handler';
import { withSecurity } from '@/lib/security';
import { AppError, ErrorType } from '@/types/errors';

export const dynamic = 'force-dynamic';

const DEFAULT_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function hashSecret(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function timingSafeSecretEqual(actual: string, expected: string): boolean {
  const actualHash = hashSecret(actual);
  const expectedHash = hashSecret(expected);
  return timingSafeEqual(actualHash, expectedHash);
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  // 兼容不支持自定义 Header 的外部 Cron 服务；默认仍推荐 Bearer Header。
  return request.nextUrl.searchParams.get('token');
}

function verifyCronToken(request: NextRequest): void {
  const expected = process.env.BACKUP_CRON_SECRET;
  if (!expected) {
    throw new AppError(ErrorType.CONFIG_ERROR, '未配置 BACKUP_CRON_SECRET', 500);
  }

  const actual = getBearerToken(request);
  if (!actual || !timingSafeSecretEqual(actual, expected)) {
    throw new AppError(ErrorType.UNAUTHORIZED, '备份触发令牌无效', 401);
  }
}

function getBackupIntervalMs(): number {
  const raw = process.env.BACKUP_CRON_MIN_INTERVAL_MS;
  if (!raw) return DEFAULT_BACKUP_INTERVAL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKUP_INTERVAL_MS;
}

async function runBackupFromCron(request: NextRequest): Promise<Response> {
  verifyCronToken(request);

  const force = request.nextUrl.searchParams.get('force') === 'true';
  const backupService = BackupService.getInstance();
  const status = await backupService.getBackupStatus();
  const intervalMs = getBackupIntervalMs();

  if (!force && status.lastBackupSuccess && status.lastBackupTime) {
    const elapsedMs = Date.now() - status.lastBackupTime.getTime();
    if (elapsedMs < intervalMs) {
      return NextResponse.json({
        success: true,
        message: '距离上次成功备份时间不足，跳过本次备份',
        data: {
          status: 'skipped',
          elapsedMs,
          intervalMs,
          lastBackupTime: status.lastBackupTime
        }
      });
    }
  }

  const result = await backupService.performBackup({ operation: 'cron', force });
  return NextResponse.json({
    success: result.success || result.status === 'skipped',
    message: result.success
      ? '数据库备份成功'
      : result.skippedReason || result.error || '数据库备份失败',
    data: result
  }, {
    status: result.success || result.status === 'skipped' ? 200 : 500
  });
}

export const POST = withErrorHandler(
  withSecurity({
    rateLimit: 'admin',
    allowedMethods: ['POST'],
    enableAccessLog: false
  })(runBackupFromCron)
);
