-- AlterTable
ALTER TABLE `absence` ADD COLUMN `nombreHeures` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `etablissement` ALTER COLUMN `updatedAt` DROP DEFAULT;
