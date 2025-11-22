import { StorageDatabaseService } from '../database/storage';
import { StorageProvider } from '../storage/base';

// Mock Prisma，注入可控的事务行为
jest.mock('../prisma', () => {
  const txImageCreate = jest.fn();
  const txImageStorageCreate = jest.fn();

  return {
    prisma: {
      $transaction: jest.fn(),
      image: { create: txImageCreate },
      imageStorageRecord: { create: txImageStorageCreate },
      group: { update: jest.fn() },
    },
  };
});

// 获取上面的 mock 实例
import { prisma } from '../prisma';

describe('StorageDatabaseService - 死锁重试', () => {
  let service: StorageDatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageDatabaseService();

    // 固定生成的 ID，方便断言
    jest.spyOn<any, any>(service as any, 'generateImageId').mockReturnValue('img_retry');
    // 避免实际等待
    jest.spyOn<any, any>(service as any, 'sleep').mockResolvedValue(undefined);
  });

  it('遇到 P2034 写冲突应自动重试并最终成功保存', async () => {
    const now = new Date();

    const mockImageCreate = (prisma.image.create as jest.Mock);
    mockImageCreate.mockResolvedValue({
      id: 'img_retry',
      url: 'https://example.com/a.jpg',
      publicId: 'pid',
      title: 't',
      description: 'd',
      tags: JSON.stringify(['tag']),
      groupId: 'grp_1',
      primaryProvider: StorageProvider.CUSTOM,
      backupProvider: null,
      storageMetadata: '{}',
      telegramFileId: null,
      telegramThumbnailFileId: null,
      telegramFilePath: null,
      telegramThumbnailPath: null,
      telegramBotToken: null,
      uploadedAt: now,
    });

    const mockRecordCreate = (prisma.imageStorageRecord.create as jest.Mock);
    mockRecordCreate.mockResolvedValue({
      id: 'rec_1',
      imageId: 'img_retry',
      provider: StorageProvider.CUSTOM,
      identifier: 'pid',
      url: 'https://example.com/a.jpg',
      metadata: '{}',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    (prisma.group.update as jest.Mock).mockResolvedValue({});

    let attempts = 0;
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      attempts += 1;
      if (attempts < 3) {
        const err: any = new Error('deadlock');
        err.code = 'P2034';
        throw err;
      }
      return cb({
        image: { create: mockImageCreate },
        imageStorageRecord: { create: mockRecordCreate },
      });
    });

    const result = await service.saveImageWithStorage({
      publicId: 'pid',
      url: 'https://example.com/a.jpg',
      title: 't',
      description: 'd',
      groupId: 'grp_1',
      tags: ['tag'],
      primaryProvider: StorageProvider.CUSTOM,
      backupProvider: undefined,
      storageResults: [
        {
          provider: StorageProvider.CUSTOM,
          result: {
            id: 'pid',
            publicId: 'pid',
            url: 'https://example.com/a.jpg',
            secureUrl: 'https://example.com/a.jpg',
            filename: 'a.jpg',
            format: 'jpg',
            width: 0,
            height: 0,
            bytes: 0,
            metadata: {},
          },
        },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.group.update).toHaveBeenCalledTimes(1);
    expect(result.groupId).toBe('grp_1');
    expect(result.storageRecords).toHaveLength(1);
  });
});
