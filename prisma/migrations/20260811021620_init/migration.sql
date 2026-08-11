/*
  Warnings:

  - Made the column `etablissementId` on table `anneeacademique` required. This step will fail if there are existing NULL values in that column.
  - Made the column `anneeAcademiqueId` on table `trimestre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ordre` on table `trimestre` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `anneeacademique` DROP FOREIGN KEY `AnneeAcademique_etablissementId_fkey`;

-- DropForeignKey
ALTER TABLE `trimestre` DROP FOREIGN KEY `Trimestre_anneeAcademiqueId_fkey`;

-- AlterTable
ALTER TABLE `anneeacademique` MODIFY `etablissementId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `etablissement` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `trimestre` MODIFY `anneeAcademiqueId` INTEGER NOT NULL,
    MODIFY `ordre` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `AnneeAcademique_etablissementId_actif_idx` ON `AnneeAcademique`(`etablissementId`, `actif`);

-- CreateIndex
CREATE INDEX `Trimestre_anneeAcademiqueId_idx` ON `Trimestre`(`anneeAcademiqueId`);

-- AddForeignKey
ALTER TABLE `Trimestre` ADD CONSTRAINT `Trimestre_anneeAcademiqueId_fkey` FOREIGN KEY (`anneeAcademiqueId`) REFERENCES `AnneeAcademique`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnneeAcademique` ADD CONSTRAINT `AnneeAcademique_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
