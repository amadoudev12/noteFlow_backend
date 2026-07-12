const {prisma} = require('../lib/prisma')
const xlsx = require('xlsx')
const bcrypt = require('bcrypt');
const sendEmail = require('../services/sendEmail');
const createEnseignantController = async (req, res) => {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }

    if (!req.file) {
        return res.status(404).json("aucun fichier n'a été sélectionné");
    }
    const idEtablissement = req.user.profil.etablissement.id
    try {
        const annee = await prisma.anneeAcademique.findFirst({
            where: { actif: true }
        });
        const filename = req.file.filename;
        const wb = xlsx.readFile(`./uploads/imports/${filename}`);
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const enseignants = xlsx.utils.sheet_to_json(sheet);
        for (let enseignant of enseignants) {
            const etablissement = await prisma.etablissement.findUnique({where:{id:idEtablissement}})
            const login = `${enseignant.prenom.toLowerCase().trim()}@${etablissement.nom.toLowerCase().trim()}.edu`
            const hashPass = await bcrypt.hash(login, 10)
            //sécuriser matricule
            const matricule = enseignant.matricule?.toString().trim();
            // if (!matricule) continue;
            // vérifier enseignant   
            let enseignantExist = await prisma.enseignant.findUnique(({
                where : {
                    matricule:matricule
                }
            }))
            if (!enseignantExist) {
                const user = await prisma.user.create({
                    data: {
                        role: "ENSEIGNANT"
                    }
                });
                const enseignantCree = await prisma.enseignant.create({
                    data: {
                        matricule: matricule,
                        nom: enseignant.nom,  
                        prenom: enseignant.prenom,
                        email:enseignant.email,
                        userId: user.id
                    }
                });
                await prisma.enseignantEtablissement.create(({
                    data : {
                        enseignant_id:enseignantCree.matricule,
                        etablissement_id:idEtablissement
                    }
                }))
            }
            const compte = await prisma.compteInstitutionnel.findFirst({
                where : {
                    userId:enseignant.userId,
                    etalissementid:idEtablissement
                }
            })

            if(compte){
                return res.status(409).json({message:'Cet enseignant possede deja un compte dans cet etablissement'})
            }

            // creation du compte 
            await prisma.compteInstitutionnel.create({
                data : {
                    login:login,
                    mot_passe:hashPass,
                    userId:enseignant.userId,
                    etalissementid:idEtablissement
                }
            })
        }

        return res.status(201).json({
            message: "Les enseignants ont été enregistrés avec succès"
        });


    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "erreur",
            error: err.message
        });
    }
};

const enseignantEtablissement = async (req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    if (!req.user.profil.etablissement) {
        return res.status(400).json({ message: "établissement introuvable" });
    }
    const idEtablissement = req.user.profil.etablissement.id
    
    try {
        const enseignants = await prisma.enseignantEtablissement.findMany({
            where : {etablissement_id:idEtablissement},
            include :{
                enseignant:true
            }
        })
        return res.status(200).json({enseignants})
    }catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "erreur",
            error: err.message
        });
    }
}

const getEnseignantByMatriculeController = async (req, res) => {
    
    const { matricule } = req.body
    if (!matricule) {
        return res.status(400).json({ message: "Veuillez fournir le matricule" })
    }

    try {
        const enseignant = await prisma.enseignant.findUnique({
            where: { matricule },
            include: {
                affectation : {
                    include : {
                        classe:true
                    }
                }
            }
        })

        if (!enseignant) {
            return res.status(404).json({ message: "Enseignant non trouvé" })
        }

        return res.status(200).json({
            message: "Enseignant trouvé",
            enseignant
        })

    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: "Erreur serveur", err })
    }
};

const classeEnseignerParEnsignant = async(req,res)=>{
    if(req.user.user.user.role !="ENSEIGNANT"){
        return res.status(403).json({message:"vous êtes pas un proffesseur"})
    }
    const matricule = req.user.profil.matricule
    try{
        const classe = await prisma.enseignant.findUnique({
            where:{matricule:matricule},
            include : {
                affectation:{
                    include:{
                        classe:true,
                        matiere:true
                    }
                }
            }
        })
        if(!classe){
            return res.status(404).json({message:"information non trouvé"})
        }
        const classeEnseigner = classe?.affectation.map(item=>({
            classe:item.classe, matiere: {id:item.matiere.id,nom:item.matiere.nom}
        }))
        return res.status(201).json({message:"liste des classe:", classeEnseigner})
    }catch(err){
        console.error(err)
        return res.status(500).json({ message: "Erreur serveur", err })
    }
}
const enseignantStatController = async (req,res)=>{
    try{
        if(req.user.user.user.role !=="ENSEIGNANT"){
            return res.status(403).json({message:"vous êtes pas un proffesseur"})
        }
        const matricule = req.user.profil.matricule
        const affectation = await prisma.affectation.findMany({
            where : {id_prof:matricule},
            select:{
                id_classe:true
            }
        })
        const nombreClasse = new Set(affectation.map(a=> a.id_classe)).size
        const classes= await prisma.affectation.findMany({
            where:{id_prof:matricule},
            select:{
                classe:{select:{id:true}}
            }
        })
        const classeIds = classes.map(item=>item.classe.id)
        const nombreEleve = await prisma.inscription.count({
            where:{
                id_classe:{in: classeIds}
            }
        })
        const nombreMatiereAffecter = await prisma.affectation.findMany({
            where : {
                id_prof: matricule
            }
        })
        const nombreMatiereSansDoublon = nombreMatiereAffecter.filter((result, index, tableau)=> 
                index === tableau.findIndex(c=> c.id_matiere === result.id_matiere)    
        )
        const nombreMatiere = nombreMatiereSansDoublon.length
        return res.status(201).json({message:"stat:", nombreClasse, nombreEleve, nombreMatiere})
    }catch(err){
        console.error(err)
        return res.status(500).json({ message: "Erreur serveur", err })
    }
}

const nombreElevesClasse = async (req, res)=>{
        if(req.user.user.user.role !=="ENSEIGNANT"){
            return res.status(403).json({message:"vous êtes pas un proffesseur"})
        }
        const matricule = req.user.profil.matricule
        try {
            const annee = await prisma.anneeAcademique.findFirst({where:{actif:true}})
            const classes = await prisma.affectation.findMany({
                where:{id_prof:matricule},
                include:{
                    classe:true
                }
            })
            const resultat = await Promise.all(
                classes.map(async(classe)=>{
                    const effectif = await prisma.inscription.count({
                        where:{
                            id_annee_academique:annee.id,
                            id_classe:classe.id_classe
                        }
                    })
                    return {
                        name:classe.classe.libelle,
                        effectif:effectif
                    }
                })
            )
            const resultatSansDoublons = resultat.filter((result, index, tableau)=>
                index === tableau.findIndex(c=> c.name === result.name)
            )
            return res.status(200).json({message:"classe et effectiff", resultat:resultatSansDoublons})
        }catch(err){
        console.error(err)
        return res.status(500).json({ message: "Erreur serveur", err })
        }
}

module.exports = {
    createEnseignantController, 
    getEnseignantByMatriculeController, 
    classeEnseignerParEnsignant,
    enseignantStatController,
    enseignantEtablissement,
    nombreElevesClasse
}