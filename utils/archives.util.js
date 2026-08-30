const { prisma } = require('../lib/prisma')
const { moyenne, getMention } = require('./util')

// ─────────────────────────────────────────────────────────────────────────────
// Statuts dérivés pour les archives académiques.
//
// Le schéma ne connaît qu'un booléen `actif` pour AnneeAcademique et Trimestre
// (voir prisma/schema.prisma). On ne rajoute donc aucun champ de statut : le
// statut affiché à l'administrateur (EN_COURS / TERMINEE / A_VENIR / CLOTURE)
// est simplement dérivé de `actif` + des dates déjà stockées.
// ─────────────────────────────────────────────────────────────────────────────

function statutAnnee(annee, now = new Date()) {
    if (annee.actif) return 'EN_COURS'
    if (new Date(annee.date_debut) > now) return 'A_VENIR'
    return 'TERMINEE'
}

function statutTrimestre(trimestre, now = new Date()) {
    if (trimestre.actif) return 'EN_COURS'
    if (new Date(trimestre.date_debut) > now) return 'A_VENIR'
    return 'CLOTURE'
}

// Un trimestre est "clôturé et consultable en lecture seule" dès qu'il n'est
// plus le trimestre actif de son année : réutilisé pour toute vérification de
// non-modification depuis le module Archives.
function estTrimestreCloture(trimestre) {
    return statutTrimestre(trimestre) === 'CLOTURE'
}

// Coefficients des matières d'une classe pour une année académique donnée,
// tels que définis par les affectations enseignant/matière/classe existantes.
async function getCoefficientsMatieres(classeId, anneeAcademiqueId) {
    const affectations = await prisma.affectation.findMany({
        where: { classeId, anneeAcademiqueId },
        include: { matiere: { select: { id: true, nom: true } } },
    })
    const map = new Map()
    for (const a of affectations) {
        if (!map.has(a.matiereId)) {
            map.set(a.matiereId, { nom: a.matiere.nom, coefficient: a.coefficient })
        }
    }
    return map
}

// Calcule, pour toute une classe et un trimestre donnés, la moyenne générale
// et le rang de chaque élève inscrit.
//
// Les fonctions équivalentes de utils/util.js (calculerMoyenne, getRang,
// moyClasse…) ciblent toujours l'année/le trimestre marqués `actif: true` et
// ne peuvent donc pas servir à consulter une période clôturée ou une ancienne
// année académique. La formule de calcul (moyenne pondérée par coefficient)
// est en revanche réutilisée telle quelle via `moyenne()` et `getMention()`.
async function getClassementClasse(classeId, anneeAcademiqueId, trimestreId) {
    const [inscriptions, coefMap, notes] = await Promise.all([
        prisma.inscription.findMany({
            where: { id_classe: classeId, id_annee_academique: anneeAcademiqueId },
            include: { eleve: { select: { matricule: true, nom: true, prenom: true } } },
        }),
        getCoefficientsMatieres(classeId, anneeAcademiqueId),
        prisma.note.findMany({
            where: {
                id_trimestre: trimestreId,
                inscription: { id_classe: classeId, id_annee_academique: anneeAcademiqueId },
            },
            select: { id_inscription: true, id_matiere: true, valeur: true, coefficient: true },
        }),
    ])

    const notesParInscription = new Map()
    for (const note of notes) {
        if (!notesParInscription.has(note.id_inscription)) {
            notesParInscription.set(note.id_inscription, new Map())
        }
        const parMatiere = notesParInscription.get(note.id_inscription)
        if (!parMatiere.has(note.id_matiere)) parMatiere.set(note.id_matiere, [])
        parMatiere.get(note.id_matiere).push({ valeur: note.valeur, coefficient: note.coefficient })
    }

    const resultats = inscriptions.map((inscription) => {
        const parMatiere = notesParInscription.get(inscription.id) ?? new Map()
        const matieres = []
        for (const [matiereId, notesMatiere] of parMatiere) {
            const infos = coefMap.get(matiereId)
            const moyenneMatiere = moyenne(notesMatiere)
            matieres.push({
                matiereId,
                matiere: infos?.nom ?? 'Matière',
                coefficient: infos?.coefficient ?? 1,
                moyenne: moyenneMatiere,
                appreciation: getMention(moyenneMatiere),
            })
        }
        const moyenneGenerale = matieres.length ? moyenne(matieres) : 0
        return {
            matricule: inscription.eleve.matricule,
            nom: inscription.eleve.nom,
            prenom: inscription.eleve.prenom,
            inscriptionId: inscription.id,
            matieres,
            moyenneGenerale,
            aDesNotes: matieres.length > 0,
        }
    })

    const avecNotes = resultats.filter((r) => r.aDesNotes)
    avecNotes.sort((a, b) => b.moyenneGenerale - a.moyenneGenerale)
    avecNotes.forEach((r, i) => { r.rang = i + 1 })
    resultats.filter((r) => !r.aDesNotes).forEach((r) => { r.rang = null })

    resultats.sort((a, b) => {
        if (a.rang == null) return b.rang == null ? 0 : 1
        if (b.rang == null) return -1
        return a.rang - b.rang
    })

    return resultats
}

module.exports = {
    statutAnnee,
    statutTrimestre,
    estTrimestreCloture,
    getCoefficientsMatieres,
    getClassementClasse,
}
