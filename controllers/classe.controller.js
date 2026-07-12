const logger = require('../lib/logger');
const { prisma } = require('../lib/prisma')
const {listeElevesRequest,  bestAndBadMoyClasse, moyClasse, meilleureByClasse, mauvaisByClasse, moyenne, moyenneElevesEtablissement,  top1classeAndBad1} = require('../utils/util')

const createClasse = async (req, res) => {
    try {
        //Vérifier authentification
        if (!req.user || !req.user.user) {
            return res.status(401).json({ message: "Utilisateur non authentifié" });
        }

        //Vérifier rôle
        if (req.user.user.user.role !="ADMIN") {
            return res.status(403).json({ message: "Accès refusé" });
        }
        //Vérifier établissement
        if (!req.user.profil.etablissement) {
            return res.status(400).json({ message: "Établissement introuvable" });
        }
        const etablissement_id = req.user.profil.etablissement.id;
        //Données envoyées
        const { nom } = req.body;
        if (!nom) {
            return res.status(400).json({ message: "Le nom de la classe est obligatoire" });
        }

        // 🔎 Vérifier si la classe existe déjà
        const classeExistante = await prisma.classe.findFirst({
            where: {
                libelle: nom,
                idEtablissement: etablissement_id
            }
        });

        if (classeExistante) {
            return res.status(400).json({ message: "Cette classe existe déjà" });
        }

        // Création
        const classe = await prisma.classe.create({
            data: {
                libelle: nom,
                idEtablissement: etablissement_id
            }
        });

        return res.status(201).json({
            message: "Classe créée avec succès",
            classe
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "Erreur serveur",
            error: err.message
        });
    }
};

const InfoClasseController = async (req, res)=>{
    const id = req.params.id
    try {
        const classe = await prisma.classe.findUnique({
            where : {
                id:Number(id)
            }
        })
        if(!classe){
            return res.status(404).json({message:'classe non trouve'})
        }
        return res.status(200).json({classe})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur",err})
    }
}

const listeEleveParClasse = async (req,res) => {
    const classe_id = req.params.id
    if(!classe_id){
        return res.status(400).json({message:'aucune classe selectionne'})
    }
    try{
        const listeEleves = await listeElevesRequest(classe_id)
        return res.status(201).json({message:'liste etudiant ',listeEleves})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur",err})
    }
}

const listeClasses = async (req,res) => {
    try {
        const classes = await prisma.classe.findMany()
        return res.status(200).json({message:"Liste des classes", classes})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur au niveau de la bd", err})
    }
}

const listeClasseByEtabblissement = async (req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un proffesseur"})
    }
    const id = req.user.profil.etablissement.id
    if(!id){
        return res.status(400).json({message:'aucune etablissement selectionne'})
    }
    try {
        const classes = await prisma.classe.findMany({
            where : {
                idEtablissement:Number(id)
            }
        })
        return res.status(200).json({message:"liste etablissement", classes})
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur au niveau de la bd", err})
    }
}

const getClasseMatiere = async (req, res)=>{
    const classe_id = req.params.id
    if(!classe_id){
        return res.status(400).json({message:'aucune classe selectionne'})
    }
    try {
        const matieres = await prisma.affectation.findMany({
            where : {id_classe: Number(classe_id)},
            include : {
                matiere:true
            }
        })
        return res.status(200).json({
            matieres
        })
    }catch(err){
        console.log(err)
        return res.status(500).json({message:"erreur dans la base",err})
    }
}

// recuperer la meilleure et mauvaise moyenne d'une classe 
const moyenneClasseController = async (req, res)=>{
    try {
        const id = req.params.id
        const moy = await moyClasse(id)
        return res.status(200).json({moy})
    }catch(err){
        console.log(err)
        return res.status(500).json({err})
    }
}

// recuperer la meilleur et mauvaise  moyenne 

// const meilleurMauvaiseMoyenne = async (req, res)=> {
//     const id = req.params.id
//     try {
//         const result = await bestAndBadMoyClasse(id)
//         return res.status(200).json({result})
//     }catch(err){
//         console.log(err)
//         return res.status(500).json({err})
//     }
// }

const classeStatController = async (req, res)=>{
    const {id_trimestre} = req.query
    const id = req.params.id
    try {
        const totalEleves = await prisma.inscription.count({
            where : {
                id_classe:Number(id)
            }
        })
        const moyenneClasse = await moyClasse(id,Number(id_trimestre))
        const result = await top1classeAndBad1(id, Number(id_trimestre)) //retourne  meillleur et la mauvaise moyenne de la classe
        console.log(result)
        return res.status(200).json({moyenne:moyenneClasse, meilleurEtMauvais:result, total:totalEleves})
    }catch(err){
        console.log(err)
        return res.status(500).json({err})
    }
}

const moyenneMatiereClasseController = async(req, res)=>{
    const id = req.params.id
    console.log("req.query-moyenne", req.query)
   const {id_trimestre} = req.query
    try {
        const matieresAffecterAvecNotes = await prisma.affectation.findMany({
            where : {
                id_classe: Number(id)
            },
            include : {
                matiere : {
                    select : {
                        nom:true,
                        notes:{
                            where:{
                                inscription:{
                                    id_classe:Number(id)
                                },
                                id_trimestre:Number(id_trimestre)
                            },
                        }
                    }
                }
            }
        })
        const matieres = matieresAffecterAvecNotes.filter((resultat, index, tableau)=> 
            index === tableau.findIndex((t)=> t.id_matiere === resultat.id_matiere)
        )
        const result = matieres.map(matiereSelect=>{
            const matiere = matiereSelect.matiere
            const moyenneMatieres = moyenne(matiere.notes)
            // console.log(matiere.notes)
            return {
                nom: matiere.nom,
                moyenneMat:moyenneMatieres ? moyenneMatieres : 0
            }
        })
        return res.status(200).json({moyneeMatieresClasse:result})
    }catch(err){
        console.log(err)
        logger.error(err)
        return res.status(500).json({err})
    }
}

const updateClasse = async (req, res) => {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    const idEtablissement = req.user.profil.etablissement.id
    try {
        const { id } = req.params;
        const { nom} = req.body;
        const classe = await prisma.classe.findUnique({
            where: { id: parseInt(id) }
        });

        if (!classe) {
            return res.status(404).json({ message: "classe introuvable" });
        }

        // Vérifier doublon dans le même établissement
        const exist = await prisma.classe.findFirst({
        where: {
            libelle:nom,
            idEtablissement:idEtablissement
        }
        });

        if (exist && exist.id !== parseInt(id)) {
        return res.status(400).json({
            message: "Cette classe existe déjà dans cet établissement"
        });
        }

        const updated = await prisma.classe.update({
        where: { id: parseInt(id) },
        data: {
            libelle:nom,
            idEtablissement:idEtablissement
        }
        });

        res.status(200).json(updated);

    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
};


const deleteClasse = async (req, res) => {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    const idEtablissement = req.user.profil.etablissement.id
    try {
        const { id } = req.params;
        // const { nom} = req.body;
        const classe = await prisma.classe.findUnique({
            where: { id: parseInt(id) }
        });

        if (!classe) {
            return res.status(404).json({ message: "classe introuvable" });
        }

        // Vérifier doublon dans le même établissement
        // const exist = await prisma.matiere.findFirst({
        //     where: {
        //         nom:nom,
        //         etablissement_id:idEtablissement
        //     }
        // });
        await prisma.affectation.deleteMany({
            where: { id_classe: parseInt(id) }
        });
        const deleteClasse = await prisma.classe.delete({
            where: { id: parseInt(id) },
        });

        res.status(200).json({message:"classe supprimé"});

    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
};

const repartitionNoterClasseController = async(req, res)=> {
    console.log(req.body)
    const {id_trimestre} = req.query
    console.log("id trimestre:",id_trimestre)
    const partition = {
        "0-5": 0,
        "5-10": 0,
        "10-15": 0,
        "15-20": 0
    }
    const id = req.params.id
    try {
        const notes = await prisma.note.findMany({
            where : {
                id_trimestre:Number(id_trimestre),
                inscription : {
                    id_classe:Number(id)
                }
            }
        })
        if (notes.length === 0) {
            return res.status(200).json({ message: "Aucune note", repartitionNote:[] });
        }
        notes.forEach(note => {
            if (note.valeur < 5) partition["0-5"]++;
            else if (note.valeur < 10) partition["5-10"]++;
            else if (note.valeur < 15) partition["10-15"]++;
            else partition["15-20"]++;
        });
        const repartitionNote = [
            {range:"0-5", count:partition['0-5']},
            {range:"5-10", count:partition['5-10']},
            {range:"10-15", count:partition['10-15']},
            {range:"15-20", count:partition['15-20']},
        ]
        return res.status(200).json({repartitionNote})
    }catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
}
module.exports = {
    listeEleveParClasse,
    listeClasses,
    listeClasseByEtabblissement,
    getClasseMatiere,
    moyenneClasseController,
    createClasse,
    updateClasse,
    deleteClasse,
    classeStatController,
    moyenneMatiereClasseController,
    repartitionNoterClasseController,
    InfoClasseController
}