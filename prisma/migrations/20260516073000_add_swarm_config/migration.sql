-- CreateTable
CREATE TABLE `swarm_configs` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `uploadStrategy` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `providerDeliveryPolicy` TEXT NULL,
    `previewDeliveryEnabled` BOOLEAN NOT NULL DEFAULT true,
    `cloudinaryNodeDeliveryRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
