const {prisma} = require('../lib/prisma')
const ajouterAffectation = async (req, res) => {
    try {
        const { id_classe, id_matiere, id_prof, coefficient } = req.body;
        // Vérifier si existe déjà
        const exist = await prisma.affectation.findUnique({
            where: {
                id_classe_id_matiere: {
                id_classe: Number(id_classe),
                id_matiere: Number(id_matiere)
                }
            }
        })
        if (exist) {
        return res.status(400).json({
            message: "Cette matière est déjà affectée à cette classe"
        });
        }
        const affectation = await prisma.affectation.create({
            data: {
                id_classe:Number(id_classe),
                id_matiere:Number(id_matiere),
                id_prof:id_prof,
                coefficient:Number(coefficient)
            }
        });
        res.status(201).json(affectation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


const modifierAffectation = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_prof, coefficient } = req.body;

        const affectation = await prisma.affectation.update({
        where: { id: parseInt(id) },
        data: {
            id_prof,
            coefficient
        }
        });
        res.json(affectation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const supprimerAffectation = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.affectation.delete({
        where: { id: parseInt(id) }
        });
        res.json({ message: "Affectation supprimée avec succès" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const getAffectationsByClasse = async (req, res) => {
    try {
        const { id_classe } = req.params;
        const affectations = await prisma.affectation.findMany({
        where: {
            id_classe: parseInt(id_classe)
        },
        include: {
            matiere: {
            select: {
                id: true,
                nom: true
            }
            },
            enseignant: {
            select: {
                matricule: true,
                nom: true,
                prenom: true
            }
            }
        }
        });
        res.json(affectations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const affectationEtablissement = async(req, res)=>{
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    const idEtablissement = req.user.profil.etablissement.id
    try {
        const affectations = await prisma.affectation.findMany({
            where :{
                classe : {
                    idEtablissement:idEtablissement
                }
            },
            include :{
                enseignant : {
                    select:{
                        matricule:true,
                        nom:true,
                        prenom:true
                    }
                },
                matiere:{
                    select :{
                        nom:true
                    }
                }
            }
        })

        if(!affectations){
            return res.status(404).json({message:'aucune affection trouve'})
        }

        return res.status(200).json({affectations})
    }catch(err){
        console.log(err)
        res.status(500).json({ message: err.message });
    }
}

module.exports = {
    ajouterAffectation,
    modifierAffectation,
    supprimerAffectation,
    getAffectationsByClasse,
    affectationEtablissement
}