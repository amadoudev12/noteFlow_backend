/*
  Warnings:

  - A unique constraint covering the columns `[compteInstitutionnelId]` on the table `Signature` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Signature_compteInstitutionnelId_key` ON `Signature`(`compteInstitutionnelId`);
