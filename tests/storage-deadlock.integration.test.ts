import { StorageDatabaseService, CreateImageData } from '@/lib/database/storage';
import { StorageProvider, StorageResult } from '@/lib/storage/base';

type DeadlockError = Error & { code?: string };

const createDeadlockError = (): DeadlockError => {
  const error = new Error('Deadlock detected') as DeadlockError;
  error.code = 'P2034';
  return error;
};

const fixedDate = new Date('2024-01-01T00:00:00Z');

jest.mock('@/lib/prisma', () => ({
  prisma: {
    image: { create: jest.fn() },
    imageStorageRecord: { create: jest.fn() },
    group: { update: jest.fn() },
    $transaction: jest.fn()
  }
}));

const { prisma: mockPrisma } = jest.requireMock('@/lib/prisma') as { prisma: any };

const baseStorageResult: StorageResult = {
  id: 'res_1',
  publicId: 'public-id',
  url: 'https://example.com/image.jpg',
  filename: 'image.jpg',
  format: 'jpg',
  bytes: 1024,
  metadata: {
    telegramFileId: 'tg-file',
    telegramThumbnailFileId: 'tg-thumb',
    telegramFilePath: 'tg-path',
    telegramThumbnailPath: 'tg-thumb-path',
    telegramBotToken: 'tg-token'
  }
};

const createImagePayload = (overrides: Partial<CreateImageData> = {}): CreateImageData => ({
  publicId: 'public-id',
  url: 'https://example.com/image.jpg',
  title: 'test image',
  description: 'desc',
  groupId: 'group-1',
  tags: ['tag'],
  primaryProvider: StorageProvider.CLOUDINARY,
  backupProvider: undefined,
  storageResults: [
    {
      provider: StorageProvider.CLOUDINARY,
      result: { ...baseStorageResult, metadata: { ...baseStorageResult.metadata } }
    }
  ],
  ...overrides
});

describe('StorageDatabaseService.saveImageWithStorage (deadlock safety)', () => {
  let service: StorageDatabaseService;
  let recordSequence: number;

  const mockSuccessfulTransaction = () => {
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const txCtx = {
        image: {
          create: jest.fn(async ({ data }: any) => ({
            ...data,
            uploadedAt: fixedDate
          }))
        },
        imageStorageRecord: {
          create: jest.fn(async ({ data }: any) => ({
            id: `rec_${recordSequence++}`,
            createdAt: fixedDate,
            updatedAt: fixedDate,
            ...data
          }))
        }
      };

      return callback({
        image: { create: txCtx.image.create },
        imageStorageRecord: { create: txCtx.imageStorageRecord.create }
      });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    recordSequence = 0;
    service = new StorageDatabaseService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rolls back when any storage record creation fails', async () => {
    const failure = new Error('storage record failed');
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        image: {
          create: jest.fn(async ({ data }: any) => ({
            ...data,
            uploadedAt: fixedDate
          }))
        },
        imageStorageRecord: {
          create: jest.fn(async () => {
            throw failure;
          })
        }
      };

      return callback({
        image: { create: tx.image.create },
        imageStorageRecord: { create: tx.imageStorageRecord.create }
      });
    });

    await expect(service.saveImageWithStorage(createImagePayload()))
      .rejects.toThrow('storage record failed');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction.mock.calls[0][1]).toEqual(expect.objectContaining({
      maxWait: 15000,
      timeout: 30000
    }));
    expect(mockPrisma.group.update).not.toHaveBeenCalled();
  });

  it('retries group count increment when encountering a single P2034 deadlock', async () => {
    mockSuccessfulTransaction();
    mockPrisma.group.update
      .mockRejectedValueOnce(createDeadlockError())
      .mockResolvedValue({ id: 'group-1', imageCount: 1 });

    jest.useFakeTimers();

    const promise = service.saveImageWithStorage(createImagePayload());

    await jest.advanceTimersByTimeAsync(40);
    await promise;

    expect(mockPrisma.group.update).toHaveBeenCalledTimes(2);
  });

  it('handles concurrent saves to the same group without propagating deadlocks', async () => {
    mockSuccessfulTransaction();

    let activeGroupUpdate = 0;
    mockPrisma.group.update.mockImplementation(() => {
      if (activeGroupUpdate > 0) {
        return Promise.reject(createDeadlockError());
      }

      activeGroupUpdate++;
      return new Promise((resolve) => {
        setTimeout(() => {
          activeGroupUpdate = Math.max(0, activeGroupUpdate - 1);
          resolve({ id: 'group-1', imageCount: 1 });
        }, 10);
      });
    });

    jest.useFakeTimers();

    const payloadA = createImagePayload();
    const payloadB = createImagePayload({ publicId: 'public-id-2' });

    const savePromises = [
      service.saveImageWithStorage(payloadA),
      service.saveImageWithStorage(payloadB)
    ];

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10); // 完成第一次 group.update
    await jest.advanceTimersByTimeAsync(40); // 等待第二次重试及完成

    const results = await Promise.all(savePromises);

    expect(results).toHaveLength(2);
    expect(mockPrisma.group.update).toHaveBeenCalledTimes(3);

  });
});

