-- AlterTable
ALTER TABLE `images` ADD COLUMN `height` INTEGER NULL,
    ADD COLUMN `orientation` VARCHAR(191) NULL,
    ADD COLUMN `width` INTEGER NULL;

-- CreateIndex
CREATE INDEX `images_width_height_idx` ON `images`(`width`, `height`);

-- CreateIndex
CREATE INDEX `images_orientation_idx` ON `images`(`orientation`);
