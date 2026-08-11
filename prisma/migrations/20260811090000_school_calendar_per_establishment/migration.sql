-- Calendar ownership is tenant-scoped. Existing rows are backfilled from
-- historical inscriptions and bulletins before the new foreign keys are added.
ALTER TABLE `AnneeAcademique` ADD COLUMN `etablissementId` INTEGER NULL;
ALTER TABLE `Trimestre` ADD COLUMN `anneeAcademiqueId` INTEGER NULL, ADD COLUMN `ordre` INTEGER NULL;

UPDATE `AnneeAcademique` a JOIN `Inscription` i ON i.`id_annee_academique` = a.`id`
SET a.`etablissementId` = i.`id_etablissement` WHERE a.`etablissementId` IS NULL;
UPDATE `AnneeAcademique` a JOIN `Bulletin` b ON b.`id_annee` = a.`id`
SET a.`etablissementId` = b.`id_etablissement` WHERE a.`etablissementId` IS NULL;

-- Review orphan years with this query before applying to production:
-- SELECT id, libelle FROM AnneeAcademique WHERE etablissementId IS NULL;
ALTER TABLE `AnneeAcademique` ADD CONSTRAINT `AnneeAcademique_etablissementId_fkey`
FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON UPDATE CASCADE;
ALTER TABLE `Trimestre` ADD CONSTRAINT `Trimestre_anneeAcademiqueId_fkey`
FOREIGN KEY (`anneeAcademiqueId`) REFERENCES `AnneeAcademique`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX `AnneeAcademique_etablissementId_libelle_key` ON `AnneeAcademique`(`etablissementId`,`libelle`);
CREATE UNIQUE INDEX `Trimestre_anneeAcademiqueId_ordre_key` ON `Trimestre`(`anneeAcademiqueId`,`ordre`);
CREATE UNIQUE INDEX `Trimestre_anneeAcademiqueId_libelle_key` ON `Trimestre`(`anneeAcademiqueId`,`libelle`);
