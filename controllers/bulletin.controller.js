const { generateClasseBulletins } = require("../utils/generate")




const genererBulletinClasse = async (req, res)=> {
    if(req.user.user.user.role !="ADMIN"){
        return res.status(403).json({message:"vous êtes pas un administrateur"})
    }
    const id_classe = req.params.id
    if(!id_classe){
        return res.status(400).json({message:'veuillez entrez les données'})
    }
    try {
        const bulletinsClasseFile = await generateClasseBulletins(Number(id_classe))
        res.status(200).json({"bulletinsClasse": bulletinsClasseFile})
    }catch(err){
        res.status(500).json({ message: "Erreur lors de la génération du bulletin" })
    }
}

module.exports = {
    genererBulletinClasse
}