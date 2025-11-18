-- AlterTable
ALTER TABLE `api_configs` ADD COLUMN `apiKey` VARCHAR(191) NULL,
    ADD COLUMN `apiKeyEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `images` ADD COLUMN `telegramBotToken` VARCHAR(191) NULL,
    ADD COLUMN `telegramFileId` VARCHAR(191) NULL,
    ADD COLUMN `telegramFilePath` VARCHAR(191) NULL,
    ADD COLUMN `telegramThumbnailFileId` VARCHAR(191) NULL,
    ADD COLUMN `telegramThumbnailPath` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `access_logs` (
    `id` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `statusCode` INTEGER NULL,
    `responseTime` INTEGER NULL,

    INDEX `access_logs_ip_idx`(`ip`),
    INDEX `access_logs_timestamp_idx`(`timestamp`),
    INDEX `access_logs_path_idx`(`path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `banned_ips` (
    `id` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `bannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bannedBy` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `banned_ips_ip_key`(`ip`),
    INDEX `banned_ips_ip_idx`(`ip`),
    INDEX `banned_ips_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ip_rate_limits` (
    `id` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `maxRequests` INTEGER NOT NULL DEFAULT 60,
    `windowMs` INTEGER NOT NULL DEFAULT 60000,
    `maxTotal` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ip_rate_limits_ip_key`(`ip`),
    INDEX `ip_rate_limits_ip_idx`(`ip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ip_total_access` (
    `ip` VARCHAR(191) NOT NULL,
    `count` BIGINT NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`ip`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `groups_createdAt_idx` ON `groups`(`createdAt`);

-- CreateIndex
CREATE INDEX `images_telegramFileId_idx` ON `images`(`telegramFileId`);

-- CreateIndex
CREATE INDEX `images_uploadedAt_idx` ON `images`(`uploadedAt`);

-- CreateIndex
CREATE INDEX `images_groupId_uploadedAt_idx` ON `images`(`groupId`, `uploadedAt`);

-- CreateIndex
CREATE INDEX `images_primaryProvider_uploadedAt_idx` ON `images`(`primaryProvider`, `uploadedAt`);
