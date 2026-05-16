-- Improve filtered random image selection and orientation-scoped scans.
CREATE INDEX `images_primaryProvider_orientation_uploadedAt_idx`
  ON `images`(`primaryProvider`, `orientation`, `uploadedAt`);

CREATE INDEX `images_groupId_primaryProvider_orientation_uploadedAt_idx`
  ON `images`(`groupId`, `primaryProvider`, `orientation`, `uploadedAt`);
