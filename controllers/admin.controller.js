const { prisma } = require("../lib/prisma")
const bcrypt = require('bcrypt')
const { meilleureByClasse, moyenneElevesEtablissement, moyenneEtablissement, NombreEleveFaiblesClasse, NombreEleveFortsClasse, mauvaisByClasse } = require("../utils/util")
// const level_hash = process.env.level_hash
const jwt = require('jsonwebtoken');
const { array } = require("../middleware/uploadsFichier");
const { connected } = require("node:process");
const sendEmail = require("../services/sendEmail");

const register = async (req, res) => {
    const isSuperAdmin = req.user?.role === "SUPERADMIN" || req.user?.user?.role === "SUPERADMIN" || req.user?.user?.user?.role === "SUPERADMIN";

    if (req.user && !isSuperAdmin) {
        return res.status(403).json({ message: "Vous n'êtes pas autorisé à effectuer cette action" });
    }

    // ── Reconstruction depuis FormData ─────────────────────────
    const admin = {
        prenom:    req.body.prenom,
        nom:       req.body.nom,
        email:     req.body.email,
        mot_passe: req.body.mot_passe,
    };

    const etablissement = {
        nom:       req.body.etab_nom,
        directeur: req.body.etab_directeur,
        adresse:   req.body.etab_adresse,
        phone:     req.body.etab_phone  || null,
        email:     req.body.etab_email  || null,
        code:      req.body.etab_code,
        statut:    req.body.etab_statut,
    };

    const signaturePath = req.file ? req.file.filename : null;

    const passwordValue = (admin.mot_passe || '').trim() || `${(admin.email || '').split('@')[0] || 'admin'}@2026`;

    // ── 1. Validation ──────────────────────────────────────────
    const missingAdmin = ['prenom', 'nom', 'email'].filter(
        (k) => !admin[k]?.trim()
    );
    const missingEtab = ['nom', 'directeur', 'adresse', 'code', 'statut'].filter(
        (k) => !etablissement[k]?.trim()
    );

    if (missingAdmin.length || missingEtab.length) {
        return res.status(400).json({
        message: 'Champs obligatoires manquants.',
        details: { admin: missingAdmin, etablissement: missingEtab },
        });
    }

    // if (!signaturePath) {
    //     return res.status(400).json({ message: 'La signature est obligatoire.' });
    // }

    

    // ── 4. Transaction Prisma 
    try {
        // ── 2. Email unique
        const emailExiste = await prisma.etablissement.findUnique({
            where: { email: admin.email },
        });
        if (emailExiste) {
            return res.status(409).json({ message: 'Un compte avec cet email existe déjà.' });
        }

        // ── 3. Code établissement unique 
        const codeExiste = await prisma.etablissement.findFirst({
            where: { code: etablissement.code },
        });
        if (codeExiste) {
            return res.status(409).json({ message: 'Ce code établissement est déjà utilisé.' });
        }
        const fileSignature = `/uploads/signatures/${signaturePath}`
        const result = await prisma.$transaction(async (tx) => {
            const nom = etablissement.nom
                .trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(/\s+/g, "")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "")
            const code = etablissement.code
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "")
                .replace(/[^a-z0-9]/g, "")
            const login = `${nom}@${code}.edu`
            const hashPass = await bcrypt.hash(passwordValue, 10)

            const user = await tx.user.create({
                data: {
                    role: 'ADMIN',
                },
            });
            console.log("user:",user)
            const administrateur = await tx.administrateur.create({
                data: {
                    nom:       admin.nom,
                    prenom:    admin.prenom,
                    email:     admin.email,  
                    userId:    user.id,
                },
            });
            console.log("administrateur:",administrateur)
            const etab = await tx.etablissement.create({
                data: {
                nom:       etablissement.nom,
                directeur: etablissement.directeur,
                adresse:   etablissement.adresse,
                phone:     etablissement.phone ?? null,
                email:     etablissement.email ?? null,
                code:      etablissement.code,
                statut:    etablissement.statut,
                admin_id:  administrateur.id
                },
            });
            const compteI = await tx.compteInstitutionnel.create({
                data : {
                    login:login,
                    mot_passe:hashPass,
                    user:{
                        connect:{
                            id:user.id
                        }
                    },
                    etablissement:{
                        connect:{
                            id:etab.id
                        }
                    }
                }
            })
            // const signature = await tx.signature.create({
            //     data : {
            //         url:fileSignature,
            //         compteInstitutionnel:{
            //             connect:{
            //                 id:compteI.id
            //             }
            //         }
            //     }
            // })
            return { user, administrateur, etab, compteI };
        });

        // ── 5. JWT ─────────────────────────────────────────────
        const token = jwt.sign(
        {
            user: {
            id:              result.user.id,
            role:            result.user.role,
            email:           admin.email,
            adminId:         result.administrateur.id,
            etablissementId: result.etab.id,
            },
        },
        process.env.SECRET_KEY,
        { expiresIn: '7d' }
        );
        await sendEmail(etablissement.directeur, admin.email, result.compteI.login, passwordValue)
        // ── 6. Réponse ─────────────────────────────────────────
        return res.status(201).json({
        message: 'Compte créé avec succès.',
        token,
        data: {
            administrateur: {
            id:        result.administrateur.id,
            nom:       result.administrateur.nom,
            prenom:    result.administrateur.prenom,
            email:     result.administrateur.email,
            signature: signaturePath,
            },
            etablissement: {
            id:        result.etab.id,
            nom:       result.etab.nom,
            code:      result.etab.code,
            statut:    result.etab.statut,
            directeur: result.etab.directeur,
            },
        },
        });
    } catch (err) {
        console.log(err)
        console.error('[register] erreur transaction :', err);
        return res.status(500).json({ message: 'Erreur serveur. Veuillez réessayer.' });
    }
};


const StatEtablissement = async (req, res) => {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    console.log(admin_id)
        if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try {
        const etablissement = await prisma.etablissement.findUnique({
            where : {admin_id : Number(admin_id)}
        })
        if(!etablissement){
            return res.status(200).json({message:"aucun etablissement trouvés"})
        }
        const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
        if (!annee) {
            return res.status(404).json({ message: "Aucune année académique active" });
        }
        const nombreEleves = await prisma.inscription.count({
            where:{
                id_annee_academique:annee.id,
                classe : {
                    etablissement : {
                        id:etablissement.id
                    }
                }
            }
        })
        const nombreClasses = await prisma.classe.count({
            where : {
                idEtablissement:etablissement.id
            }
        })
        
        const nombreEnseignants = await prisma.enseignantEtablissement.count({
            where : {
                etablissement_id:etablissement.id
            }
        })
        const moyEtablisement = await moyenneEtablissement(admin_id)
        console.log('nombre',nombreEnseignants, nombreEleves, nombreClasses, moyEtablisement)
        return res.status(200).json({nombreEleves:nombreEleves ?? "0", nombreClasses:nombreClasses?? "0", nombreEnseignants:nombreEnseignants??"0", moyenneEtablissement:moyEtablisement??"0"})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur:",err})
    }
}


const listePlusFaiblesMoyennes = async (req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
        if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try{
        const moyennesEleves = await moyenneElevesEtablissement(admin_id, "faibles")
        if (!Array.isArray(moyennesEleves)) {
            return res.status(500).json({
                message: "Erreur lors de la récupération des moyennes",
                data: moyennesEleves
            })
        }
    const faibles = moyennesEleves.sort((a, b) => a.moyenne - b.moyenne)
    return res.status(200).json({ elevesFaibles: faibles })
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur lors de la recuperation", err})
    }
}
const listePlusFortesMoyennes = async (req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id

    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try{
        const moyennesEleves = await moyenneElevesEtablissement(admin_id,"meilleure")
        if (!Array.isArray(moyennesEleves)) {
            return res.status(500).json({
                message: "Erreur lors de la récupération des moyennes",
                data: moyennesEleves
            })
        }
        const fortes = moyennesEleves.sort((a,b)=> b.moyenne - a.moyenne)
        return res.status(200).json({elevesForts:fortes})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur lors de la recuperation", err})
    }
}

// recupere le nombre d'eleves faibles par clase 

const NombreEleveFaiblesByClasseController = async(req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }

    try {
        const result = await NombreEleveFaiblesClasse(admin_id)
        if(!Array.isArray(result)){
            return res.status(500).json({
                message: "Erreur lors de la récupération des moyennes",
                data: moyennesEleves
            })
        }
        return res.status(200).json({result})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur lors de la recuperation", err})
    }
}
// recupere le nombre d'eleves forts par clase 

const NombreEleveFortByClasseController = async(req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }

    try {
        const result = await NombreEleveFortsClasse(admin_id)
        if(!Array.isArray(result)){
            return res.status(500).json({
                message: "Erreur lors de la récupération des moyennes",
                data: moyennesEleves
            })
        }
        return res.status(200).json({result})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur lors de la recuperation", err})
    }
}


const meilleureByClasseController = async(req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }

    try {
        const etablissement = await prisma.etablissement.findUnique({where:{admin_id:admin_id}})
        const listeClasse = await prisma.classe.findMany({where:{idEtablissement:etablissement.id}})
        
        const resultat = await Promise.all(
            listeClasse.map(async (classe)=>{
                const meilleuresClasse = await meilleureByClasse(classe.id)
                return {
                    classe:classe.libelle,
                    eleves: meilleuresClasse.sort((a,b)=> b.moyenne - a.moyenne)
                }
            })
        )
        console.log(resultat)
        return res.status(200).json({message:"les meilleurs eleves par classe",resultat})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur lors de la recuperation", err})
    }
}
const mauvaisByClasseController = async(req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }

    try {
        const etablissement = await prisma.etablissement.findUnique({where:{admin_id:admin_id}})
        const listeClasse = await prisma.classe.findMany({where:{idEtablissement:etablissement.id}})
        
        const resultat = await Promise.all(
            listeClasse.map(async (classe)=>{
                const mauvaisEleves = await mauvaisByClasse(classe.id)
                return {
                    classe:classe.libelle,
                    eleves: mauvaisEleves
                }
            })
        )
        return res.status(200).json({message:"les  eleves faibles par classe",resultat})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur lors de la recuperation", err})
    }
}

module.exports = {
    StatEtablissement,
    listePlusFaiblesMoyennes,
    listePlusFortesMoyennes,
    meilleureByClasseController,
    mauvaisByClasseController,
    register,
    NombreEleveFaiblesByClasseController,
    NombreEleveFortByClasseController
}