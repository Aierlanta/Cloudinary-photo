-- CreateTable
CREATE TABLE `security_configs` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `guardEnabled` BOOLEAN NOT NULL DEFAULT false,
    `guardAutoEnabled` BOOLEAN NOT NULL DEFAULT false,
    `guardTriggerWindowMinutes` INTEGER NOT NULL DEFAULT 5,
    `guardTriggerUniqueIpThreshold` INTEGER NOT NULL DEFAULT 50,
    `whitelistOnlyEnabled` BOOLEAN NOT NULL DEFAULT false,
    `guardTriggeredAt` DATETIME(3) NULL,
    `guardTriggeredReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ip_whitelist_entries` (
    `id` VARCHAR(191) NOT NULL,
    `cidr` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ip_whitelist_entries_cidr_key`(`cidr`),
    INDEX `ip_whitelist_entries_isEnabled_idx`(`isEnabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
