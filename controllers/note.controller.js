const { prisma } = require("../lib/prisma")
const logger = require("../lib/logger")
const { generateFicheNote } = require("../utils/generate")
const { getNotesClasseByMatiere } = require("../utils/util")


const postNote = async (req, res) => {
    const { config, notes } = req.body

    try {
        if (!config || !notes || !Array.isArray(notes)) {
            return res.status(400).json({
                message: 'Configuration et notes requises'
            })
        }

        // Récupérer les données nécessaires
        const trimestre = await prisma.trimestre.findFirst({ where: { actif: true } })
        if (!trimestre) {
            return res.status(400).json({ message: 'Aucun trimestre actif' })
        }

        const matiere = await prisma.matiere.findFirst({
            where: { nom: config.matiere },
            select: { id: true }
        })
        if (!matiere) {
            return res.status(404).json({ message: 'Matière non trouvée' })
        }

        const annee = await prisma.anneeAcademique.findFirst({ where: { actif: true } })
        if (!annee) {
            return res.status(400).json({ message: 'Aucune année académique active' })
        }

        // Utiliser une transaction pour créer toutes les notes
        const createdNotes = await prisma.$transaction(async (tx) => {
            const notesToCreate = []

            for (const note of notes) {
                // Valider les données de la note
                if (!note.matricule || note.note === undefined) {
                    throw new Error(`Données invalides pour la note: ${JSON.stringify(note)}`)
                }

                if (note.note < 0 || note.note > 20) {
                    throw new Error(`Note invalide (${note.note}): doit être entre 0 et 20`)
                }

                // Trouver l'inscription
                const inscription = await tx.inscription.findUnique({
                    where: {
                        matricule_eleve_id_annee_academique: {
                            matricule_eleve: note.matricule,
                            id_annee_academique: annee.id
                        }
                    }
                })

                if (!inscription) {
                    throw new Error(`Inscription non trouvée pour ${note.matricule}`)
                }

                notesToCreate.push({
                    id_trimestre: trimestre.id_trimestre,
                    id_matiere: matiere.id,
                    id_inscription: inscription.id,
                    typeEvaluation: config.type,
                    coefficient: Number(config.coefficient),
                    valeur: Number(note.note)
                })
            }

            // Créer toutes les notes en une seule opération
            const result = await tx.note.createMany({
                data: notesToCreate,
                skipDuplicates: false
            })

            return result
        })

        logger.info(`Notes créées avec succès: ${createdNotes.count} notes`)
        return res.status(201).json({
            message: 'Notes enregistrées avec succès',
            count: createdNotes.count
        })
    } catch (err) {
        logger.error('Erreur lors de la création des notes', { error: err.message })
        return res.status(500).json({
            message: "Erreur lors de l'enregistrement des notes"
        })
    }
}

const getNotesByElveId = async (req, res) => {
    const matricule = req.params.id

    try {
        if (!matricule) {
            return res.status(400).json({ message: 'Matricule requis' })
        }

        const annee = await prisma.anneeAcademique.findFirst({ where: { actif: true } })
        if (!annee) {
            return res.status(400).json({ message: 'Aucune année académique active' })
        }

        const inscription = await prisma.inscription.findUnique({
            where: {
                matricule_eleve_id_annee_academique: {
                    matricule_eleve: matricule,
                    id_annee_academique: annee.id
                }
            }
        })

        if (!inscription) {
            return res.status(404).json({ message: 'Élève non trouvé' })
        }

        const notes = await prisma.note.findMany({
            where: { id_inscription: inscription.id },
            select: {
                typeEvaluation: true,
                coefficient: true,
                valeur: true,
                matiere: { select: { nom: true } }
            }
        })

        if (notes.length === 0) {
            return res.status(404).json({ message: "Aucune note enregistrée" })
        }

        const noteFinal = notes.map((note) => ({
            type: note.typeEvaluation,
            coefficient: note.coefficient,
            valeur: note.valeur,
            matiere: note.matiere.nom
        }))

        return res.status(200).json({
            message: "Notes récupérées",
            notes: noteFinal
        })
    } catch (err) {
        logger.error('Erreur lors de la récupération des notes', { error: err.message })
        return res.status(500).json({ message: "Erreur serveur" })
    }
}

// Récupérer les notes d'une classe pour créer la fiche de note
const getAllNotesByClasseByMatier = async (req, res) => {
    const { id_classe, id_matiere } = req.body

    try {
        if (!id_classe || !id_matiere) {
            return res.status(400).json({
                message: 'ID classe et matière requis'
            })
        }

        const annee = await prisma.anneeAcademique.findFirst({ where: { actif: true } })
        if (!annee) {
            return res.status(400).json({ message: 'Aucune année académique active' })
        }

        const trimestre = await prisma.trimestre.findFirst({ where: { actif: true } })
        if (!trimestre) {
            return res.status(400).json({ message: 'Aucun trimestre actif' })
        }

        // Récupérer les données de manière optimisée
        const [classe, matiere, professeur] = await Promise.all([
            prisma.classe.findUnique({
                where: { id: id_classe },
                select: {
                    libelle: true,
                    etablissement: { select: { nom: true } }
                }
            }),
            prisma.matiere.findUnique({
                where: { id: Number(id_matiere) },
                select: { nom: true }
            }),
            prisma.affectation.findFirst({
                where: {
                    id_classe: id_classe,
                    id_matiere: Number(id_matiere)
                },
                include: {
                    enseignant: {
                        select: { nom: true, prenom: true, userId: true }
                    }
                }
            })
        ])

        // Vérifier l'existence des données
        if (!classe) {
            return res.status(404).json({ message: 'Classe non trouvée' })
        }
        if (!matiere) {
            return res.status(404).json({ message: 'Matière non trouvée' })
        }
        if (!professeur) {
            return res.status(404).json({ message: 'Affectation professeur non trouvée' })
        }

        const notes = await getNotesClasseByMatiere(
            id_classe,
            id_matiere,
            trimestre.id_trimestre
        )

        const infosProf = `${professeur.enseignant.nom} ${professeur.enseignant.prenom}`
        const profUserId = professeur.enseignant.userId

        const listeFile = await generateFicheNote(
            notes,
            matiere.nom,
            classe.etablissement.nom,
            trimestre.libelle,
            classe.libelle,
            infosProf,
            profUserId
        )

        return res.download(listeFile, "liste-notes")
    } catch (err) {
        logger.error('Erreur lors de la génération de la fiche de note', { error: err.message })
        return res.status(500).json({ message: "Erreur serveur" })
    }
}

const getAllNotesByMatiere = async (req, res) => {
    const { id_classe, id_matiere } = req.body
    try {
        if (!id_classe || !id_matiere) {
            return res.status(400).json({
                message: 'ID classe et matière requis'
            })
        }

        const trimestre = await prisma.trimestre.findFirst({
            where: { actif: true }
        })

        if (!trimestre) {
            return res.status(400).json({ message: 'Aucun trimestre actif' })
        }

        const result = await getNotesClasseByMatiere(
            id_classe,
            id_matiere,
            trimestre.id_trimestre
        )

        return res.status(200).json({
            message: "Notes récupérées",
            notes: result
        })
    } catch (err) {
        logger.error('Erreur lors de la récupération des notes par matière', { error: err.message })
        return res.status(500).json({ message: "Erreur serveur" })
    }
}

const noteRepartition = async (req, res) => {
    const partition = {
        "0-5": 0,
        "5-10": 0,
        "10-15": 0,
        "15-20": 0
    }

    try {
        if (!req.user || req.user.user.user.role !="ADMIN") {
            return res.status(403).json({ message: "Accès refusé" })
        }

        const admin_id = req.user.profil.id
        // console.log("admin_id:", admin_id)

        if (!admin_id) {
            return res.status(400).json({ message: 'Administrateur invalide' })
        }

        const annee = await prisma.anneeAcademique.findFirst({ where: { actif: true } })
        if (!annee) {
            return res.status(400).json({ message: 'Aucune année académique active' })
        }

        const etablissement = await prisma.etablissement.findUnique({
            where: { admin_id: admin_id }
        })
        if (!etablissement) {
            return res.status(404).json({ message: 'Établissement non trouvé' })
        }

        const trimestre = await prisma.trimestre.findFirst({ where: { actif: true } })
        if (!trimestre) {
            return res.status(400).json({ message: 'Aucun trimestre actif' })
        }

        // Récupérer les notes de manière optimisée
        const notes = await prisma.note.findMany({
            where: {
                inscription: {
                    classe: { idEtablissement: etablissement.id },
                    id_annee_academique: annee.id
                },
                id_trimestre: trimestre.id_trimestre
            },
            select: { valeur: true }
        })
        if (notes.length === 0) {
            return res.status(200).json({ message: "Aucune note",  repartition:[] });
        }
        // Distribuer les notes
        notes.forEach((note) => {
            if (note.valeur < 5) partition["0-5"]++
            else if (note.valeur < 10) partition["5-10"]++
            else if (note.valeur < 15) partition["10-15"]++
            else partition["15-20"]++
        })

        const repartition = [
            { range: "0–5", count: partition["0-5"] },
            { range: "5–10", count: partition["5-10"] },
            { range: "10–15", count: partition["10-15"] },
            { range: "15–20", count: partition["15-20"] }
        ]
        console.log(repartition)
        return res.status(200).json({
            message: "Répartition des notes",
            repartition: repartition
        })
    } catch (err) {
        logger.error('Erreur lors du calcul de répartition', { error: err.message })
        return res.status(500).json({ message: "Erreur serveur" })
    }
}

module.exports = {
    postNote,
    getNotesByElveId,
    getAllNotesByClasseByMatier,
    noteRepartition,
    getAllNotesByMatiere
}