const { prisma } = require('../lib/prisma')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const logger = require('../lib/logger')
const supabase = require('../lib/supabaseClient')

const secret_key = process.env.SECRET_KEY
const level_hash = parseInt(process.env.level_hash || '10')

const loginController = async (req, res) => {
    const { login, mot_passe } = req.body
    console.log("login:",login, mot_passe)
    try {
        if(login == process.env.SUPERADMIN_LOGIN && process.env.SUPERADMIN_PASSWORD){
            const token = jwt.sign(
                {
                nom:"DIALLO",
                prenom:"EL HADJ AMADOU",
                role:"SUPER_ADMIN"
                },
                secret_key,
                { expiresIn: "7d" }
            )
            return res.json({message:"Bienvenue", token})
        }
        // Rechercher l'utilisateur
        const user = await prisma.compteInstitutionnel.findUnique({
            where : {
                login
            },
            select : {
                id:true,
                login:true,
                mot_passe:true,
                user:true,
                firstLogin:true
            }
        })
        // const user = await prisma.user.findUnique({
        //     where: { login },
        //     select: {
        //         id: true,
        //         login: true,
        //         mot_passe: true,
        //         role: true,
        //         firstLogin: true
        //     }
        // })

        if (!user) {
            logger.warn(`Tentative de connexion échouée: utilisateur ${login} non trouvé`)
            return res.status(401).json({
                message: "Identifiants incorrects"
            })
        }

        // Comparer le mot de passe
        const hashCompare = await bcrypt.compare(mot_passe, user.mot_passe)
        if (!hashCompare) {
            logger.warn(`Tentative de connexion échouée: mauvais mot de passe pour ${login}`)
            return res.status(401).json({
                message: "Identifiants incorrects"
            })
        }

        // Récupérer le profil correspondant au rôle
        let profil = null
        const profileSelect = { matricule: true, nom: true, prenom: true }
        const profileSelectAdmin = { id: true, nom: true, prenom: true }

        if (user.user.role === "ELEVE") {
            profil = await prisma.eleve.findUnique({
                where: { userId: user.user.id},
                select: profileSelect
            })
        } else if (user.user.role === "ENSEIGNANT") {
            profil = await prisma.enseignant.findUnique({
                where: { userId:user.user.id },
                select: profileSelect
            })
        } else if (user.user.role === "ADMIN") {
            profil = await prisma.administrateur.findUnique({
                where: { userId: user.user.id },
                select: {
                    ...profileSelectAdmin,
                    etablissement: {
                        select: { id: true, nom: true }
                    }
                }
            })
        }

        // Créer le JWT avec payload minimal
        const token = jwt.sign(
            {
                user, profil
            },
            secret_key,
            { expiresIn: "7d" }
        )

        logger.info(`Connexion réussie: ${login}`)
        return res.status(200).json({
            message: `Bienvenue ${profil?.nom || "utilisateur"}`,
            token,
            firstLogin: user.firstLogin,
            role: user.user.role
        })
    } catch (err) {
        logger.error('Erreur lors de la connexion', { error: err.message, login })
        return res.status(500).json({
            message: "Erreur serveur"
        })
    }
}

const modificationController = async (req, res) => {
    console.log("salut")
    const { login, password } = req.body
    const profileSelect = { matricule: true, nom: true, prenom: true }
    const profileSelectAdmin = { id: true, nom: true, prenom: true }
    try {
        // console.log(req.user)
        if (!req.user) {
            return res.status(403).json({
                message: "Authentification requise"
            })
        }
        
        const userId = req.user.user.id
        if (!userId) {
            return res.status(403).json({
                message: "Utilisateur invalide"
            })
        }
        const role = req.user.user.user.role
        // Vérifier que la signature est fournie si l'utilisateur est enseignant
        if (["ENSEIGNANT", "ADMIN"].includes(role) && !req.file) {
            return res.status(400).json({
                message: "Signature requise pour les administrateurs et les enseignants"
            })
        }

        // Hash the password before the atomic account-completion transaction.
        const hashPass = await bcrypt.hash(password, level_hash)

        // Mettre à jour l'utilisateur dans une transaction
        const signatureRequise = ["ENSEIGNANT", "ADMIN"].includes(role)
        const updatedUser = await prisma.$transaction(async (tx) => {
            if (signatureRequise) {
                const filePath = `/uploads/signatures/${req.file.filename}`
                await tx.signature.upsert({
                    where: { compteInstitutionnelId: userId },
                    update: { url: filePath },
                    create: { url: filePath, compteInstitutionnelId: userId }
                })
            }
            return tx.compteInstitutionnel.update({
                where: { id: userId },
                data: { mot_passe: hashPass, firstLogin: false, signatureComplete: signatureRequise },
                select: { id: true, login: true, firstLogin: true, signatureComplete: true, user: true }
            })
        })
        
        let profil = null
        if (req.user.user.user.role  === "ELEVE") {
            profil = await prisma.eleve.findUnique({
                where: { userId: updatedUser.user.id },
                select: profileSelect
            })
        } else if (role === "ENSEIGNANT"){
            profil = await prisma.enseignant.findUnique({
                where: { userId: updatedUser.user.id },
                select: profileSelect
            })
        } else if (role === "ADMIN"){
            profil = await prisma.administrateur.findUnique({
                where: { userId: updatedUser.user.id },
                select: {
                    ...profileSelectAdmin,
                    etablissement: {
                        select: { id: true, nom: true }
                    }
                }
            })
        }
        // Créer le nouveau token
        const token = jwt.sign(
            {
                user: updatedUser, profil
            },
            secret_key,
            { expiresIn: "7d" }
        )

        logger.info(`Première connexion complétée: ${login}`)
        return res.status(200).json({
            message: "Première connexion effectuée avec succès",
            token,
            configurationComplete: updatedUser.firstLogin === false && (!signatureRequise || updatedUser.signatureComplete === true),
            firstLogin: updatedUser.firstLogin,
            signatureComplete: updatedUser.signatureComplete,
            role
        })

    } catch (err) {
        console.log(err)
        logger.error('Erreur lors de la modification utilisateur', { error: err.message })
        return res.status(500).json({
            message: "Erreur serveur"
        })
    }
}

module.exports = {
    loginController,
    modificationController
}
