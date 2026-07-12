const { prisma } = require("../lib/prisma")
const { moyClasse, moyenne } = require("../utils/util")

const postEtablissement = async (req, res) => {
    const body = req.body
    if(!body){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try {
        const {nom, adresse, phone, email, code, statut, directeur, admin_id} = body
        const existEtablissement = await prisma.etablissement.findUnique({
            where : {
                admin_id:admin_id
            }
        })
        if(existEtablissement){
            await prisma.etablissement.update({
                where : {
                    id:existEtablissement.id
                },
                data : {
                    nom:nom,
                    adresse:adresse,
                    phone:phone,
                    email:email,
                    code:code,
                    statut:statut,
                    directeur:directeur,
                    admin_id:Number(admin_id)
                }
            })
            return res.status(201).json({message:"etablissement modifié"})
        }
        await prisma.etablissement.create({
            data : {
                nom:nom,
                adresse:adresse,
                phone:phone,
                email:email,
                code:code,
                statut:statut,
                directeur:directeur,
                admin_id:Number(admin_id)
            }
        })
        return res.status(201).json({message:"etablissement crée"})
    }catch(err){
        return res.status(500).json("erreur lors de l'enregistrement")
    }
}

const getEtablissementByIdAdmin = async (req, res) => {
    const id = req.params.id
    try {
        const etablissement = await prisma.etablissement.findUnique({
            where : {admin_id : Number(id)}
        })
        if(etablissement){
            return res.status(200).json({message:"etatblissement", etablissement})
        }
    }catch(err){
        return res.status(500).json(err)
    }
}



const moyenneGeneralesEtablissemetEvolution = async (req,res)=> {
    const admin_id = req.user.profil.id
    try {
        const etablissement = await prisma.etablissement.findUnique({
            where : {
                admin_id:admin_id
            }
        })
        const moyennes = await prisma.bulletin.groupBy({
            by: ['idtrimestre','id_etablissement'],
            where:{
                id_etablissement:etablissement.id
            },
            _avg: {
                moyenneGenerale: true,
            },
            orderBy: {
                idtrimestre: 'asc',
            },
        })
        const courbeData = moyennes.map(moy=>{
            return {
                trimestre:'T'+moy.idtrimestre,
                moyenne:moy._avg.moyenneGenerale
            }
        })
        return res.status(200).json({courbeData})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:'erreur au niveau  de la base de donnée'})
    }
}


// moyenne des classes 
const moyennesClasseEtablissement = async (req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try {
        const etablissement = await prisma.etablissement.findUnique({where:{admin_id:admin_id}})
        const classes = await prisma.classe.findMany({where:{idEtablissement:etablissement.id}})
        // const moyennesClasses = []
        const moyenneClasses = await Promise.all(
            classes.map( async(classe)=>{
                const moyenne = await moyClasse(classe.id)
                const nom = classe.libelle
                return {
                    classe: nom,
                    moyenne: moyenne ? moyenne :  "0"
                }
            })
        )
        console.log(moyenneClasses)
        return res.status(200).json({moyenneClasses})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"imposible d'acceder au serveur"})
    }
}

// moyenne par matiere de l'etablissement 

const moyenneMatieres = async (req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    try{
        const etablissement = await prisma.etablissement.findUnique({where:{admin_id:admin_id}})

        // recuperer toutes les matiere enseignées par l'etablissement 
        const matieres = await prisma.affectation.findMany({
            where : {
                classe:{
                    idEtablissement: etablissement.id
                }
            },
            include :{
                matiere : {
                    select: {
                        id:true,
                        nom:true,
                        notes: true
                    }
                }
            }
        })
        // console.log(matieres[0].matiere?.notes)
        const resultat = matieres.map(mat => {
            const moyMat = moyenne(mat.matiere.notes)
            // console.log(moyMat)
            const nom = mat.matiere.nom
            return {
                matiere: nom,
                moyenne: moyMat
            }
        })
        const  moyenneMatieres = resultat.filter((result, index, tableau)=>
                index === tableau.findIndex(c=> c.matiere === result.matiere)
            )
        return  res.status(200).json({message:"moyenne par matiere", moyenneMatieres})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"imposible d'acceder au serveur"})
    }
}

module.exports = {
    postEtablissement,
    getEtablissementByIdAdmin,
    moyenneGeneralesEtablissemetEvolution,
    moyennesClasseEtablissement,
    moyenneMatieres
}