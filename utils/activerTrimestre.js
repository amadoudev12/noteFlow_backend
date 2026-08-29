const { prisma } = require('../lib/prisma')
const { generateClasseBulletins } = require('./generate')

const activerTrimestreAutomatique = async () => {
    try {
        const aujourdHui = new Date()

        // Récupérer tous les établissements
        const etablissements = await prisma.etablissement.findMany({
            select: { id: true, nom: true }
        })

        for (const etablissement of etablissements) {
            // Chercher le trimestre correspondant à la date actuelle,
            // uniquement parmi les trimestres liés à cet établissement
            // (via anneeAcademique.etablissementId)
            const trimestreActuel = await prisma.trimestre.findFirst({
                where: {
                    date_debut: { lte: aujourdHui },
                    date_fin: { gte: aujourdHui },
                    anneeAcademique: {
                        etablissementId: etablissement.id
                    }
                },
                orderBy: {
                    date_debut: 'desc' // en cas de chevauchement, on prend le plus récent à commencer
                }
            })

            if (!trimestreActuel) {
                console.log(`Aucun trimestre actif pour aujourd'hui pour l'établissement "${etablissement.nom}" (id: ${etablissement.id})`)
                continue
            }

            // Si le bon trimestre est déjà actif, ne rien faire
            if (trimestreActuel.actif) {
                console.log(`Trimestre déjà actif pour "${etablissement.nom}" : ${trimestreActuel.libelle}`)
                continue
            }

            // Désactiver UNIQUEMENT les trimestres de cet établissement
            await prisma.trimestre.updateMany({
                where: {
                    anneeAcademique: {
                        etablissementId: etablissement.id
                    }
                },
                data: { actif: false }
            })

            // Activer uniquement le trimestre correspondant de cet établissement
            const trimestreActive = await prisma.trimestre.update({
                where: { id_trimestre: trimestreActuel.id_trimestre },
                data: { actif: true }
            })

            console.log(`Trimestre activé pour "${etablissement.nom}" : ${trimestreActive.libelle}`)
        }
    } catch (error) {
        console.log("Erreur activation automatique :", error)
    }
}

module.exports = activerTrimestreAutomatique