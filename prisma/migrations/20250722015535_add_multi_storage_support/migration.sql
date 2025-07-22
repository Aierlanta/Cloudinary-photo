-- CreateTable
CREATE TABLE `images` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `publicId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `tags` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `primaryProvider` VARCHAR(191) NOT NULL DEFAULT 'cloudinary',
    `backupProvider` VARCHAR(191) NULL,
    `storageMetadata` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `groups_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_configs` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `defaultScope` VARCHAR(191) NOT NULL DEFAULT 'all',
    `defaultGroups` TEXT NULL,
    `allowedParameters` TEXT NULL,
    `enableDirectResponse` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counters` (
    `id` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `image_storage_records` (
    `id` VARCHAR(191) NOT NULL,
    `imageId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `metadata` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `image_storage_records_imageId_idx`(`imageId`),
    INDEX `image_storage_records_provider_idx`(`provider`),
    INDEX `image_storage_records_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storage_configs` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `primaryProvider` VARCHAR(191) NOT NULL DEFAULT 'cloudinary',
    `backupProvider` VARCHAR(191) NULL,
    `failoverEnabled` BOOLEAN NOT NULL DEFAULT true,
    `retryAttempts` INTEGER NOT NULL DEFAULT 3,
    `retryDelay` INTEGER NOT NULL DEFAULT 1000,
    `healthCheckInterval` INTEGER NOT NULL DEFAULT 300,
    `enableBackupUpload` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_logs` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `level` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `context` TEXT NULL,
    `error` TEXT NULL,
    `userId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `type` VARCHAR(191) NULL,

    INDEX `system_logs_timestamp_idx`(`timestamp`),
    INDEX `system_logs_level_idx`(`level`),
    INDEX `system_logs_type_idx`(`type`),
    INDEX `system_logs_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `images` ADD CONSTRAINT `images_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `image_storage_records` ADD CONSTRAINT `image_storage_records_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `images`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
