-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('ADMIN', 'ENSEIGNANT', 'ELEVE') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompteInstitutionnel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `login` VARCHAR(191) NOT NULL,
    `mot_passe` VARCHAR(191) NOT NULL,
    `firstLogin` BOOLEAN NOT NULL DEFAULT true,
    `signatureComplete` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,
    `etablissementId` INTEGER NOT NULL,

    UNIQUE INDEX `CompteInstitutionnel_login_key`(`login`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Signature` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(191) NOT NULL,
    `compteInstitutionnelId` INTEGER NOT NULL,
    `createAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updateAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Eleve` (
    `matricule` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `dateNaissance` DATETIME(3) NULL,
    `lieuNaissance` VARCHAR(191) NULL,
    `sexe` ENUM('M', 'F') NULL,
    `affecte` ENUM('oui', 'non') NOT NULL DEFAULT 'non',
    `boursier` ENUM('oui', 'non') NOT NULL DEFAULT 'non',
    `redoublant` ENUM('oui', 'non') NOT NULL DEFAULT 'non',
    `nationalite` VARCHAR(191) NOT NULL DEFAULT 'Ivoirienne',
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Eleve_matricule_key`(`matricule`),
    UNIQUE INDEX `Eleve_email_key`(`email`),
    UNIQUE INDEX `Eleve_userId_key`(`userId`),
    PRIMARY KEY (`matricule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enseignant` (
    `matricule` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Enseignant_userId_key`(`userId`),
    PRIMARY KEY (`matricule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CertificatFrequentation` (
    `id` VARCHAR(191) NOT NULL,
    `numero` VARCHAR(191) NOT NULL,
    `date_emission` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eleve_id` VARCHAR(191) NOT NULL,
    `annee_academique_id` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CertificatFrequentation_numero_key`(`numero`),
    INDEX `CertificatFrequentation_eleve_id_idx`(`eleve_id`),
    INDEX `CertificatFrequentation_annee_academique_id_idx`(`annee_academique_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Administrateur` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Administrateur_email_key`(`email`),
    UNIQUE INDEX `Administrateur_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Classe` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `libelle` VARCHAR(191) NOT NULL,
    `idEtablissement` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Matiere` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `etablissement_id` INTEGER NOT NULL,

    UNIQUE INDEX `Matiere_nom_etablissement_id_key`(`nom`, `etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trimestre` (
    `id_trimestre` INTEGER NOT NULL AUTO_INCREMENT,
    `libelle` VARCHAR(191) NOT NULL,
    `date_debut` DATETIME(3) NOT NULL,
    `date_fin` DATETIME(3) NOT NULL,
    `actif` BOOLEAN NOT NULL,

    PRIMARY KEY (`id_trimestre`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `valeur` DOUBLE NOT NULL,
    `typeEvaluation` VARCHAR(191) NOT NULL,
    `coefficient` INTEGER NOT NULL DEFAULT 1,
    `id_inscription` INTEGER NOT NULL,
    `id_matiere` INTEGER NOT NULL,
    `id_trimestre` INTEGER NOT NULL,
    `dateEvaluation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Note_id_inscription_idx`(`id_inscription`),
    INDEX `Note_id_matiere_idx`(`id_matiere`),
    INDEX `Note_id_trimestre_idx`(`id_trimestre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Affectation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `classeId` INTEGER NOT NULL,
    `matiereId` INTEGER NOT NULL,
    `compteInstitutionnelId` INTEGER NOT NULL,
    `anneeAcademiqueId` INTEGER NOT NULL,
    `coefficient` INTEGER NOT NULL,

    INDEX `Affectation_classeId_idx`(`classeId`),
    INDEX `Affectation_matiereId_idx`(`matiereId`),
    INDEX `Affectation_compteInstitutionnelId_idx`(`compteInstitutionnelId`),
    INDEX `Affectation_anneeAcademiqueId_idx`(`anneeAcademiqueId`),
    UNIQUE INDEX `Affectation_classeId_matiereId_compteInstitutionnelId_anneeA_key`(`classeId`, `matiereId`, `compteInstitutionnelId`, `anneeAcademiqueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Absence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_heure` INTEGER NOT NULL,
    `matricule_eleve` VARCHAR(191) NOT NULL,
    `trimestreId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Absence_matricule_eleve_trimestreId_key`(`matricule_eleve`, `trimestreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Etablissement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `statut` VARCHAR(191) NOT NULL,
    `directeur` VARCHAR(191) NOT NULL,
    `admin_id` INTEGER NOT NULL,

    UNIQUE INDEX `Etablissement_id_key`(`id`),
    UNIQUE INDEX `Etablissement_email_key`(`email`),
    UNIQUE INDEX `Etablissement_admin_id_key`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bulletin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eleveId` VARCHAR(191) NOT NULL,
    `idtrimestre` INTEGER NOT NULL,
    `id_annee` INTEGER NOT NULL,
    `id_etablissement` INTEGER NOT NULL,
    `moyenneGenerale` DOUBLE NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `rang` INTEGER NOT NULL,
    `mention` VARCHAR(191) NULL,
    `fichier_url` VARCHAR(191) NULL,

    UNIQUE INDEX `Bulletin_eleveId_idtrimestre_id_annee_key`(`eleveId`, `idtrimestre`, `id_annee`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnneeAcademique` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `libelle` VARCHAR(191) NOT NULL,
    `date_debut` DATETIME(3) NOT NULL,
    `date_fin` DATETIME(3) NOT NULL,
    `actif` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompteurCertificat` (
    `id` VARCHAR(191) NOT NULL,
    `annee_academique_id` INTEGER NOT NULL,
    `compteur` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompteurCertificat_annee_academique_id_key`(`annee_academique_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matricule_eleve` VARCHAR(191) NOT NULL,
    `id_classe` INTEGER NOT NULL,
    `id_annee_academique` INTEGER NOT NULL,
    `id_etablissement` INTEGER NOT NULL,
    `dateInscription` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Inscription_matricule_eleve_id_annee_academique_key`(`matricule_eleve`, `id_annee_academique`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnseignantEtablissement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enseignant_id` VARCHAR(191) NOT NULL,
    `etablissement_id` INTEGER NOT NULL,

    UNIQUE INDEX `EnseignantEtablissement_enseignant_id_etablissement_id_key`(`enseignant_id`, `etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompteInstitutionnel` ADD CONSTRAINT `CompteInstitutionnel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompteInstitutionnel` ADD CONSTRAINT `CompteInstitutionnel_etablissementId_fkey` FOREIGN KEY (`etablissementId`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signature` ADD CONSTRAINT `Signature_compteInstitutionnelId_fkey` FOREIGN KEY (`compteInstitutionnelId`) REFERENCES `CompteInstitutionnel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Eleve` ADD CONSTRAINT `Eleve_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enseignant` ADD CONSTRAINT `Enseignant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CertificatFrequentation` ADD CONSTRAINT `CertificatFrequentation_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `Eleve`(`matricule`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CertificatFrequentation` ADD CONSTRAINT `CertificatFrequentation_annee_academique_id_fkey` FOREIGN KEY (`annee_academique_id`) REFERENCES `AnneeAcademique`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Administrateur` ADD CONSTRAINT `Administrateur_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Classe` ADD CONSTRAINT `Classe_idEtablissement_fkey` FOREIGN KEY (`idEtablissement`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Matiere` ADD CONSTRAINT `Matiere_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_id_inscription_fkey` FOREIGN KEY (`id_inscription`) REFERENCES `Inscription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_id_matiere_fkey` FOREIGN KEY (`id_matiere`) REFERENCES `Matiere`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_id_trimestre_fkey` FOREIGN KEY (`id_trimestre`) REFERENCES `Trimestre`(`id_trimestre`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Affectation` ADD CONSTRAINT `Affectation_classeId_fkey` FOREIGN KEY (`classeId`) REFERENCES `Classe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Affectation` ADD CONSTRAINT `Affectation_matiereId_fkey` FOREIGN KEY (`matiereId`) REFERENCES `Matiere`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Affectation` ADD CONSTRAINT `Affectation_compteInstitutionnelId_fkey` FOREIGN KEY (`compteInstitutionnelId`) REFERENCES `CompteInstitutionnel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Affectation` ADD CONSTRAINT `Affectation_anneeAcademiqueId_fkey` FOREIGN KEY (`anneeAcademiqueId`) REFERENCES `AnneeAcademique`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Absence` ADD CONSTRAINT `Absence_matricule_eleve_fkey` FOREIGN KEY (`matricule_eleve`) REFERENCES `Eleve`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Absence` ADD CONSTRAINT `Absence_trimestreId_fkey` FOREIGN KEY (`trimestreId`) REFERENCES `Trimestre`(`id_trimestre`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Etablissement` ADD CONSTRAINT `Etablissement_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `Administrateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bulletin` ADD CONSTRAINT `Bulletin_eleveId_fkey` FOREIGN KEY (`eleveId`) REFERENCES `Eleve`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bulletin` ADD CONSTRAINT `Bulletin_idtrimestre_fkey` FOREIGN KEY (`idtrimestre`) REFERENCES `Trimestre`(`id_trimestre`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bulletin` ADD CONSTRAINT `Bulletin_id_annee_fkey` FOREIGN KEY (`id_annee`) REFERENCES `AnneeAcademique`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bulletin` ADD CONSTRAINT `Bulletin_id_etablissement_fkey` FOREIGN KEY (`id_etablissement`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompteurCertificat` ADD CONSTRAINT `CompteurCertificat_annee_academique_id_fkey` FOREIGN KEY (`annee_academique_id`) REFERENCES `AnneeAcademique`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_matricule_eleve_fkey` FOREIGN KEY (`matricule_eleve`) REFERENCES `Eleve`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_id_classe_fkey` FOREIGN KEY (`id_classe`) REFERENCES `Classe`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_id_annee_academique_fkey` FOREIGN KEY (`id_annee_academique`) REFERENCES `AnneeAcademique`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_id_etablissement_fkey` FOREIGN KEY (`id_etablissement`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnseignantEtablissement` ADD CONSTRAINT `EnseignantEtablissement_enseignant_id_fkey` FOREIGN KEY (`enseignant_id`) REFERENCES `Enseignant`(`matricule`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnseignantEtablissement` ADD CONSTRAINT `EnseignantEtablissement_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `Etablissement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
