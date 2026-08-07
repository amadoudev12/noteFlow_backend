/*
  Warnings:

  - Added the required column `updatedAt` to the `Etablissement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `etablissement` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `typeEtablissement` ENUM('PUBLIC', 'PRIVE', 'PROFESSIONNEL', 'UNIVERSITE') NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
