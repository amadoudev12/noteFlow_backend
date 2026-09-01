const { prisma } = require("../lib/prisma")
const logger = require("../lib/logger")
const { generateFicheNote } = require("../utils/generate")
const { getNotesClasseByMatiere } = require("../utils/util")
const { getSchoolContext, getActiveSchoolYear, getActiveTerm } = require('../utils/schoolContext')


const postNote = async (req, res) => {
    const { config, notes } = req.body

    try {
        const context = await getSchoolContext(req)
        if (context.user.role !== 'ENSEIGNANT') return res.status(403).json({ message: 'Accès réservé aux enseignants' })
        if (!config || !notes || !Array.isArray(notes)) {
            return res.status(400).json({
                message: 'Configuration et notes requises'
            })
        }

        // Récupérer les données nécessaires
        const annee = await getActiveSchoolYear(context.etablissementId)
        const trimestre = annee && await getActiveTerm(context.etablissementId, annee.id)
        if (!trimestre) {
            return res.status(400).json({ message: 'Aucun trimestre actif' })
        }

        const matiere = await prisma.matiere.findFirst({
            where: { nom: config.matiere, etablissement_id: context.etablissementId },
            select: { id: true }
        })
        if (!matiere) {
            return res.status(404).json({ message: 'Matière non trouvée' })
        }

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
                const affectation = await tx.affectation.findFirst({ where: { classeId: inscription.id_classe, matiereId: matiere.id, compteInstitutionnelId: context.id, anneeAcademiqueId: annee.id } })
                if (!affectation) throw new Error('Vous n’êtes pas affecté à cette classe et cette matière')

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
    const matricule = req.params.id;

    try {
        if (!matricule) {
            return res.status(400).json({
                message: "Matricule requis"
            });
        }

        // Récupérer l'élève et son inscription pour son établissement
        const eleve = await prisma.eleve.findUnique({
            where: {
                matricule
            },
            include: {
                inscriptions: {
                    include: {
                        annee: true
                    },
                    orderBy: {
                        id_annee_academique: "desc"
                    }
                }
            }
        });

        if (!eleve) {
            return res.status(404).json({
                message: "Élève non trouvé"
            });
        }

        // Trouver l'inscription correspondant à l'année active
        const inscription = eleve.inscriptions.find(
            (inscription) => inscription.annee.actif === true
        );

        if (!inscription) {
            return res.status(404).json({
                message: "Aucune inscription pour l'année académique active"
            });
        }

        // Récupérer le trimestre actif de cette année
        const trimestre = await prisma.trimestre.findFirst({
            where: {
                anneeAcademiqueId: inscription.id_annee_academique,
                actif: true
            }
        });

        if (!trimestre) {
            return res.status(404).json({
                message: "Aucun trimestre actif"
            });
        }

        // Récupérer uniquement les notes de l'inscription
        // et du trimestre actif
        const notes = await prisma.note.findMany({
            where: {
                id_inscription: inscription.id,
                id_trimestre: trimestre.id_trimestre
            },
            select: {
                typeEvaluation: true,
                coefficient: true,
                valeur: true,
                matiere: {
                    select: {
                        nom: true
                    }
                }
            }
        });

        if (notes.length === 0) {
            return res.status(404).json({
                message: "Aucune note enregistrée"
            });
        }

        const noteFinal = notes.map((note) => ({
            type: note.typeEvaluation,
            coefficient: note.coefficient,
            valeur: note.valeur,
            matiere: note.matiere.nom
        }));

        return res.status(200).json({
            message: "Notes récupérées",
            notes: noteFinal
        });

    } catch (err) {
        logger.error(
            "Erreur lors de la récupération des notes",
            { error: err.message }
        );

        return res.status(500).json({
            message: "Erreur serveur"
        });
    }
};
// Récupérer les notes d'une classe pour créer la fiche de note
const getAllNotesByClasseByMatier = async (req, res) => {
    const { id_classe, id_matiere } = req.body

    try {
        if (!id_classe || !id_matiere) {
            return res.status(400).json({
                message: 'ID classe et matière requis'
            })
        }

        // Récupérer les données de manière optimisée
        const [classe, matiere, professeur] = await Promise.all([
            prisma.classe.findUnique({
                where: { id: Number(id_classe) },
                select: {
                    idEtablissement: true,
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
                    classeId: Number(id_classe),
                    matiereId: Number(id_matiere)
                },
                select : {
                    compteInstitutionnel : {
                        select:{
                            id:true,
                            user:{
                                select : {
                                    enseignant:true
                                }
                            }
                        }
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

        const annee = await getActiveSchoolYear(classe.idEtablissement)
        if (!annee) {
            return res.status(400).json({ message: 'Aucune année académique active' })
        }
        const trimestre = await getActiveTerm(classe.idEtablissement, annee.id)
        if (!trimestre) {
            return res.status(400).json({ message: 'Aucun trimestre actif' })
        }

        const notes = await getNotesClasseByMatiere(
            id_classe,
            id_matiere,
            trimestre.id_trimestre
        )

        const infosProf = `${professeur.compteInstitutionnel?.user.enseignant.nom} ${professeur.compteInstitutionnel?.user.enseignant.prenom}`
        const profcompteId = professeur.compteInstitutionnel?.id

        const listeFile = await generateFicheNote(
            notes,
            matiere.nom,
            classe.etablissement.nom,
            trimestre.libelle,
            classe.libelle,
            infosProf,
            profcompteId
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

        const classe = await prisma.classe.findUnique({
            where: { id: Number(id_classe) },
            select: { idEtablissement: true }
        })
        if (!classe) {
            return res.status(404).json({ message: 'Classe non trouvée' })
        }

        const annee = await getActiveSchoolYear(classe.idEtablissement)
        const trimestre = annee && await getActiveTerm(classe.idEtablissement, annee.id)

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

        const etablissement = await prisma.etablissement.findUnique({
            where: { admin_id: admin_id }
        })
        if (!etablissement) {
            return res.status(404).json({ message: 'Établissement non trouvé' })
        }

        const annee = await getActiveSchoolYear(etablissement.id)
        if (!annee) {
            return res.status(400).json({ message: 'Aucune année académique active' })
        }

        const trimestre = await getActiveTerm(etablissement.id, annee.id)
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
