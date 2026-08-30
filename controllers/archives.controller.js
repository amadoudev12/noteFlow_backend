const { prisma } = require('../lib/prisma')
const { getSchoolContext } = require('../utils/schoolContext')
const {
    statutAnnee,
    statutTrimestre,
    getClassementClasse,
} = require('../utils/archives.util')

// Toutes les routes de ce module sont en LECTURE SEULE : aucune écriture n'est
// exposée ici (pas de POST/PATCH/DELETE). La consultation des trimestres
// clôturés et des années terminées ne peut donc jamais modifier une note, un
// résultat ou une absence.

const isAdmin = (req) => req.user?.user?.user?.role === 'ADMIN'

const fail = (res, error) =>
    res.status(error.status || 500).json({ message: error.message || 'Erreur serveur' })

// Vérifie qu'un trimestre appartient bien à l'établissement de l'administrateur
// connecté et retourne le trimestre + son année académique.
async function ownedTrimestre(ctx, trimestreId) {
    return prisma.trimestre.findFirst({
        where: {
            id_trimestre: Number(trimestreId),
            anneeAcademique: { etablissementId: ctx.etablissementId },
        },
        include: { anneeAcademique: true },
    })
}

async function ownedClasse(ctx, classeId) {
    return prisma.classe.findFirst({
        where: { id: Number(classeId), idEtablissement: ctx.etablissementId },
    })
}

// GET /admin/archives/annees
// Liste des années académiques de l'établissement, avec leur statut dérivé.
exports.getAnneesArchive = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
        const ctx = await getSchoolContext(req)

        const annees = await prisma.anneeAcademique.findMany({
            where: { etablissementId: ctx.etablissementId },
            orderBy: { date_debut: 'desc' },
        })

        res.json(
            annees.map((a) => ({
                id: a.id,
                libelle: a.libelle,
                date_debut: a.date_debut,
                date_fin: a.date_fin,
                actif: a.actif,
                statut: statutAnnee(a),
            }))
        )
    } catch (e) {
        fail(res, e)
    }
}

// GET /admin/archives/annees/:anneeId/trimestres
// Trimestres d'une année académique, avec statut et compteurs utiles à
// l'affichage (élèves inscrits, matières affectées) pour ne pas nécessiter un
// second aller-retour depuis les cartes de la page d'archives.
exports.getTrimestresArchive = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
        const ctx = await getSchoolContext(req)
        const anneeId = Number(req.params.anneeId)

        const annee = await prisma.anneeAcademique.findFirst({
            where: { id: anneeId, etablissementId: ctx.etablissementId },
        })
        if (!annee) return res.status(404).json({ message: 'Année académique introuvable' })

        const trimestres = await prisma.trimestre.findMany({
            where: { anneeAcademiqueId: anneeId },
            orderBy: { ordre: 'asc' },
        })

        const [nbElevesInscrits, nbMatieres] = await Promise.all([
            prisma.inscription.count({ where: { id_annee_academique: anneeId } }),
            prisma.affectation
                .findMany({
                    where: { anneeAcademiqueId: anneeId },
                    select: { matiereId: true },
                    distinct: ['matiereId'],
                })
                .then((rows) => rows.length),
        ])

        res.json({
            annee: { id: annee.id, libelle: annee.libelle, statut: statutAnnee(annee) },
            trimestres: trimestres.map((t) => ({
                id: t.id_trimestre,
                libelle: t.libelle,
                date_debut: t.date_debut,
                date_fin: t.date_fin,
                ordre: t.ordre,
                actif: t.actif,
                statut: statutTrimestre(t),
                nbEleves: nbElevesInscrits,
                nbMatieres,
            })),
        })
    } catch (e) {
        fail(res, e)
    }
}

// GET /admin/archives/annees/:anneeId/trimestres/:trimestreId
// Détail d'un trimestre : statistiques globales + résultats résumés par classe.
exports.getTrimestreDetailArchive = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
        const ctx = await getSchoolContext(req)
        const anneeId = Number(req.params.anneeId)
        const trimestreId = Number(req.params.trimestreId)

        const trimestre = await prisma.trimestre.findFirst({
            where: { id_trimestre: trimestreId, anneeAcademiqueId: anneeId, anneeAcademique: { etablissementId: ctx.etablissementId } },
            include: { anneeAcademique: true },
        })
        if (!trimestre) return res.status(404).json({ message: 'Trimestre introuvable' })

        const classes = await prisma.classe.findMany({
            where: {
                idEtablissement: ctx.etablissementId,
                inscriptions: { some: { id_annee_academique: anneeId } },
            },
            orderBy: { libelle: 'asc' },
        })

        const [nbMatieres, resultatsParClasse] = await Promise.all([
            prisma.affectation
                .findMany({ where: { anneeAcademiqueId: anneeId }, select: { matiereId: true }, distinct: ['matiereId'] })
                .then((rows) => rows.length),
            Promise.all(
                classes.map(async (classe) => {
                    const classement = await getClassementClasse(classe.id, anneeId, trimestreId)
                    const avecNotes = classement.filter((r) => r.aDesNotes)
                    const moyenneClasse = avecNotes.length
                        ? Number((avecNotes.reduce((s, r) => s + r.moyenneGenerale, 0) / avecNotes.length).toFixed(2))
                        : null
                    return {
                        classeId: classe.id,
                        libelle: classe.libelle,
                        nbEleves: classement.length,
                        moyenneClasse,
                    }
                })
            ),
        ])

        const nbEleves = resultatsParClasse.reduce((s, c) => s + c.nbEleves, 0)

        res.json({
            annee: { id: trimestre.anneeAcademique.id, libelle: trimestre.anneeAcademique.libelle, statut: statutAnnee(trimestre.anneeAcademique) },
            trimestre: {
                id: trimestre.id_trimestre,
                libelle: trimestre.libelle,
                date_debut: trimestre.date_debut,
                date_fin: trimestre.date_fin,
                statut: statutTrimestre(trimestre),
            },
            statistiques: { nbEleves, nbClasses: classes.length, nbMatieres },
            classes: resultatsParClasse,
        })
    } catch (e) {
        fail(res, e)
    }
}

// GET /admin/archives/trimestres/:trimestreId/classes/:classeId
// Résultats détaillés (moyenne, rang) des élèves d'une classe pour ce trimestre.
exports.getClasseResultatsArchive = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
        const ctx = await getSchoolContext(req)
        const trimestreId = Number(req.params.trimestreId)
        const classeId = Number(req.params.classeId)

        const trimestre = await ownedTrimestre(ctx, trimestreId)
        if (!trimestre) return res.status(404).json({ message: 'Trimestre introuvable' })

        const classe = await ownedClasse(ctx, classeId)
        if (!classe) return res.status(404).json({ message: 'Classe introuvable' })

        const classement = await getClassementClasse(classeId, trimestre.anneeAcademiqueId, trimestreId)

        res.json({
            annee: { id: trimestre.anneeAcademique.id, libelle: trimestre.anneeAcademique.libelle, statut: statutAnnee(trimestre.anneeAcademique) },
            trimestre: { id: trimestre.id_trimestre, libelle: trimestre.libelle, statut: statutTrimestre(trimestre) },
            classe: { id: classe.id, libelle: classe.libelle },
            eleves: classement.map((r) => ({
                matricule: r.matricule,
                nom: r.nom,
                prenom: r.prenom,
                moyenneGenerale: r.moyenneGenerale,
                rang: r.rang,
                aDesNotes: r.aDesNotes,
            })),
        })
    } catch (e) {
        fail(res, e)
    }
}

// GET /admin/archives/eleves/:matricule/trimestres/:trimestreId
// Bulletin de résultats (lecture seule) d'un élève pour un trimestre donné :
// moyennes par matière, rang, bilan des absences et bulletin PDF si généré.
exports.getEleveTrimestreArchive = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
        const ctx = await getSchoolContext(req)
        const { matricule } = req.params
        const trimestreId = Number(req.params.trimestreId)

        const trimestre = await ownedTrimestre(ctx, trimestreId)
        if (!trimestre) return res.status(404).json({ message: 'Trimestre introuvable' })

        const inscription = await prisma.inscription.findFirst({
            where: {
                matricule_eleve: matricule,
                id_annee_academique: trimestre.anneeAcademiqueId,
                id_etablissement: ctx.etablissementId,
            },
            include: { eleve: true, classe: true },
        })
        if (!inscription) return res.status(404).json({ message: 'Élève introuvable pour cette période' })

        const classement = await getClassementClasse(inscription.id_classe, trimestre.anneeAcademiqueId, trimestreId)
        const resultat = classement.find((r) => r.matricule === matricule)

        const absences = await prisma.absence.findMany({
            where: { eleveId: matricule, trimestreId, anneeAcademiqueId: trimestre.anneeAcademiqueId },
        })
        const totalHeures = absences.reduce((t, a) => t + (a.nombreHeures ?? 1), 0)
        const heuresJustifiees = absences.filter((a) => a.justifie === 'oui').reduce((t, a) => t + (a.nombreHeures ?? 1), 0)

        const bulletin = await prisma.bulletin.findUnique({
            where: {
                eleveId_idtrimestre_id_annee: {
                    eleveId: matricule,
                    idtrimestre: trimestreId,
                    id_annee: trimestre.anneeAcademiqueId,
                },
            },
        })

        res.json({
            annee: { id: trimestre.anneeAcademique.id, libelle: trimestre.anneeAcademique.libelle, statut: statutAnnee(trimestre.anneeAcademique) },
            trimestre: { id: trimestre.id_trimestre, libelle: trimestre.libelle, statut: statutTrimestre(trimestre) },
            eleve: {
                matricule: inscription.eleve.matricule,
                nom: inscription.eleve.nom,
                prenom: inscription.eleve.prenom,
                classe: { id: inscription.classe.id, libelle: inscription.classe.libelle },
            },
            moyenneGenerale: resultat?.moyenneGenerale ?? 0,
            rang: resultat?.rang ?? null,
            effectifClasse: classement.length,
            matieres: resultat?.matieres ?? [],
            absences: {
                totalHeures,
                heuresJustifiees,
                heuresNonJustifiees: totalHeures - heuresJustifiees,
                nombre: absences.length,
            },
            bulletin: bulletin ? { fichier_url: bulletin.fichier_url, decision: bulletin.decision, mention: bulletin.mention } : null,
        })
    } catch (e) {
        fail(res, e)
    }
}

// GET /admin/archives/eleves/:matricule
// Dossier académique historique d'un élève : toutes les années/trimestres
// disponibles pour l'établissement de l'administrateur connecté, avec un
// résumé (classe, moyenne, rang) pour chacun.
exports.getEleveHistoriqueArchive = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ message: 'Accès réservé à l’administrateur' })
        const ctx = await getSchoolContext(req)
        const { matricule } = req.params

        const eleve = await prisma.eleve.findUnique({ where: { matricule } })
        if (!eleve) return res.status(404).json({ message: 'Élève introuvable' })

        const inscriptions = await prisma.inscription.findMany({
            where: { matricule_eleve: matricule, id_etablissement: ctx.etablissementId },
            include: { classe: true, annee: true },
            orderBy: { id_annee_academique: 'desc' },
        })

        // Élève jamais inscrit dans cet établissement : ne rien révéler de plus
        // qu'un 404, quel que soit son parcours dans d'autres établissements.
        if (!inscriptions.length) return res.status(404).json({ message: 'Élève introuvable' })

        const historique = []
        for (const inscription of inscriptions) {
            const trimestres = await prisma.trimestre.findMany({
                where: { anneeAcademiqueId: inscription.id_annee_academique },
                orderBy: { ordre: 'asc' },
            })
            const periodes = []
            for (const trimestre of trimestres) {
                const classement = await getClassementClasse(inscription.id_classe, inscription.id_annee_academique, trimestre.id_trimestre)
                const resultat = classement.find((r) => r.matricule === matricule)
                if (!resultat?.aDesNotes) continue
                periodes.push({
                    trimestreId: trimestre.id_trimestre,
                    libelle: trimestre.libelle,
                    statut: statutTrimestre(trimestre),
                    moyenneGenerale: resultat.moyenneGenerale,
                    rang: resultat.rang,
                    effectifClasse: classement.length,
                })
            }
            historique.push({
                anneeId: inscription.id_annee_academique,
                annee: inscription.annee.libelle,
                statutAnnee: statutAnnee(inscription.annee),
                classe: { id: inscription.classe.id, libelle: inscription.classe.libelle },
                trimestres: periodes,
            })
        }

        res.json({
            eleve: { matricule: eleve.matricule, nom: eleve.nom, prenom: eleve.prenom },
            historique,
        })
    } catch (e) {
        fail(res, e)
    }
}
