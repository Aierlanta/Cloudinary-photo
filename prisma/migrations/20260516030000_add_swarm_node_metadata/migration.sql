-- Add node ownership metadata for swarm delivery routing.
ALTER TABLE `images`
  ADD COLUMN `ownerNodeId` VARCHAR(191) NULL,
  ADD COLUMN `ownerNodeBaseUrl` VARCHAR(191) NULL;

ALTER TABLE `image_storage_records`
  ADD COLUMN `ownerNodeId` VARCHAR(191) NULL,
  ADD COLUMN `ownerNodeBaseUrl` VARCHAR(191) NULL;

CREATE INDEX `images_ownerNodeId_uploadedAt_idx` ON `images`(`ownerNodeId`, `uploadedAt`);
CREATE INDEX `image_storage_records_ownerNodeId_idx` ON `image_storage_records`(`ownerNodeId`);
