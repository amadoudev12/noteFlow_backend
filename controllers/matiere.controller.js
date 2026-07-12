const {prisma }= require('../lib/prisma')


const getAllMatieres = async (req, res) => {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    const idEtablissement = req.user.profil.etablissement.id
    try {
        const matieres = await prisma.matiere.findMany({
            where:{
                etablissement_id:idEtablissement
            },
            orderBy: { nom: "asc" },
        })
        res.status(200).json({matieres})
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
}
const createMatiere = async (req, res) => {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const admin_id = req.user.profil.id
    if(!admin_id){
        return res.status(400).json({message:'fournissez les donnés'})
    }
    const etablissement_id = req.user.profil.etablissement.id
    try {
        const { nom } = req.body
        if (!nom) {
            return res.status(400).json({ message: "Le nom est obligatoire" });
        }
        // Vérifier doublon
        const exist = await prisma.matiere.findFirst({
            where: { nom, etablissement_id }
        });
        if (exist) {
            return res.status(400).json({
                message: "Cette matière existe déjà"
            });
        }
        const matiere = await prisma.matiere.create({
            data: { nom, etablissement_id }
        });
        return res.status(201).json(matiere);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erreur serveur" });
    }
}

const updateMatiere = async (req, res) => {
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
        const matiere = await prisma.matiere.findUnique({
            where: { id: parseInt(id) }
        });

        if (!matiere) {
        return res.status(404).json({ message: "Matière introuvable" });
        }

        // Vérifier doublon dans le même établissement
        const exist = await prisma.matiere.findFirst({
        where: {
            nom:nom,
            etablissement_id:idEtablissement
        }
        });

        if (exist && exist.id !== parseInt(id)) {
        return res.status(400).json({
            message: "Cette matière existe déjà dans cet établissement"
        });
        }

        const updated = await prisma.matiere.update({
        where: { id: parseInt(id) },
        data: {
            nom:nom,
            etablissement_id:idEtablissement
        }
        });

        res.status(200).json(updated);

    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
}

const deleteMatiere = async (req, res) => {
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
        const matiere = await prisma.matiere.findUnique({
            where: { id: parseInt(id) }
        });

        if (!matiere) {
            return res.status(404).json({ message: "Matière introuvable" });
        }

        // Vérifier doublon dans le même établissement
        // const exist = await prisma.matiere.findFirst({
        //     where: {
        //         nom:nom,
        //         etablissement_id:idEtablissement
        //     }
        // });
        await prisma.affectation.deleteMany({
            where: { id_matiere: parseInt(id) }
        });
        const deleteMatiere = await prisma.matiere.delete({
            where: { id: parseInt(id) },
        });

        res.status(200).json({message:"matiere supprimé"});

    } catch (error) {
        res.status(500).json({ message: "Erreur serveur" });
    }
};


module.exports = {
    createMatiere,
    getAllMatieres,
    updateMatiere,
    deleteMatiere
}