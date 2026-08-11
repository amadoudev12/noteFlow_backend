const { prisma } = require("../lib/prisma");
const { getSchoolContext, getActiveSchoolYear } = require('../utils/schoolContext');


// Ajouter une affectation
const ajouterAffectation = async (req, res) => {
  // 1. Vérification du rôle avec chaînage optionnel (?.)
  if (req.user?.user?.user?.role !== "ADMIN") {
    return res.status(403).json({
      message: "Vous n'êtes pas administrateur",
    });
  }

  let idEtablissement;

  try {
    idEtablissement = (await getSchoolContext(req)).etablissementId;
    const {
        id_classe,
        id_matiere,
        id_prof,
        coefficient,
    } = req.body;

    // recuperer le profeeseusseur 
    const enseignant = await prisma.enseignant.findUnique({
    where: {
        matricule: id_prof,
    },
    });
    const compte = await prisma.compteInstitutionnel.findFirst({
        where : {
            userId:enseignant.userId,
            etablissementId:idEtablissement
        }
    })
    if (!compte) {
      return res.status(404).json({
        message: "Cet enseignant n'appartient pas à cet établissement",
      });
    }
    // 2. Récupération de l'année académique active
    const annee = await getActiveSchoolYear(idEtablissement);

    if (!annee) {
        return res.status(400).json({
            message: "Aucune année active",
        });
    }

    // 3. Vérification de la classe
    const classe = await prisma.classe.findFirst({
        where: {
            id: Number(id_classe),
            idEtablissement: idEtablissement,
        },
    });
    console.log(classe)
    if (!classe) {
      return res.status(404).json({
        message: "Classe inexistante dans cet établissement",
      });
    }

    // 4. Vérification de la matière
    const matiere = await prisma.matiere.findFirst({
      where: {
        id: Number(id_matiere),
        etablissement_id: idEtablissement,
      },
    });

    if (!matiere) {
      return res.status(404).json({
        message: "Cette matière n'appartient pas à cet établissement",
      });
    }


    // 6. Vérification des doublons
    const existe = await prisma.affectation.findUnique({
      where: {
        classeId_matiereId_compteInstitutionnelId_anneeAcademiqueId: {
          classeId: Number(id_classe),
          matiereId: Number(id_matiere),
          compteInstitutionnelId: Number(compte.id),
          anneeAcademiqueId: annee.id,
        },
      },
    });

    if (existe) {
      return res.status(400).json({
        message: "Cette affectation existe déjà",
      });
    }

    // 7. Création de l'affectation
    const affectation = await prisma.affectation.create({
      data: {
        classeId: Number(id_classe),
        matiereId: Number(id_matiere),
        compteInstitutionnelId: Number(compte.id),
        anneeAcademiqueId: annee.id,
        coefficient: Number(coefficient),
      },
      include: {
        classe: true,
        matiere: true,
        compteInstitutionnel: {
            include:{
                user:{
                    include:{
                        enseignant:true
                    }
                }
            }
        },
      },
    });

    return res.status(201).json(affectation);

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      message: "Erreur serveur lors de l'ajout de l'affectation",
    });
  }
};

// Modifier une affectation

const modifierAffectation = async(req,res)=>{

    try{

        const {id}=req.params;

        const {
            enseignantEtablissementId,
            coefficient
        }=req.body;


        const affectation =
        await prisma.affectation.update({

            where:{
                id:Number(id)
            },

            data:{
                enseignantEtablissementId:Number(
                    enseignantEtablissementId
                ),
                coefficient:Number(coefficient)
            },

            include:{
                classe:true,
                matiere:true,
                enseignantEtablissement:{
                    include:{
                        enseignant:true
                    }
                }
            }

        });


        res.json(affectation);


    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};





// Supprimer une affectation

const supprimerAffectation = async(req,res)=>{
    try{
        const {id}=req.params;
        await prisma.affectation.delete({
            where:{
                id:Number(id)
            }
        });
        res.json({
            message:"Affectation supprimée"
        });
    }catch(error){
        res.status(500).json({
            message:error.message
        });
    }
};

// Récupérer les affectations d'une classe
const getAffectationsByClasse = async(req,res)=>{
    try{
        const {id_classe}=req.params;
        const affectations =
        await prisma.affectation.findMany({
            where:{
                classeId:Number(id_classe)
            },
            include:{
                matiere:{
                    select:{
                        id:true,
                        nom:true
                    }
                },
                enseignantEtablissement:{
                    include:{
                        enseignant:{
                            select:{
                                matricule:true,
                                nom:true,
                                prenom:true
                            }
                        }
                    }
                }
            }
        });
        res.json(affectations);
    }catch(error){
        res.status(500).json({
            message:error.message
        });

    }

};

// Toutes les affectations d'un établissement
const affectationEtablissement = async(req,res)=>{
    if(req.user.user.user.role !== "ADMIN"){
        return res.status(403).json({
            message:"Accès refusé"
        });
    }
    try{
        const idEtablissement = (await getSchoolContext(req)).etablissementId;
        const affectations =
        await prisma.affectation.findMany({
            where:{
                classe : {
                    idEtablissement:idEtablissement
                },
                anneeAcademique:{ actif:true, etablissementId:idEtablissement }
            },
            include:{
                classe:true,
                matiere:true,
                compteInstitutionnel : {
                    include:{
                        user:{
                            include:{
                                enseignant:true
                            }
                        }
                    }
                }
            }
        });
        console.log(affectations)
        return res.json({
            affectations
        });
    }catch(error){
        console.log(error);
        res.status(500).json({
            message:error.message
        });
    }
};

// Récupérer les classes d'un enseignant

const getClassesEnseignant = async(req,res)=>{
    try{
        const context = await getSchoolContext(req);
        const compteId = context.id;
        const affectations =
        await prisma.affectation.findMany({
            where:{
                compteInstitutionnelId:compteId,
                anneeAcademique:{ actif:true, etablissementId:context.etablissementId }
            },
            select:{
                classe:true,
                matiere:true
            }
        });
        if(affectations.length===0){
            return res.status(404).json({
                message:"Aucune classe affectée"
            });
        }
        res.json(affectations);
    }catch(error){
        res.status(500).json({
            message:error.message
        });
    }

};


module.exports={
    ajouterAffectation,
    modifierAffectation,
    supprimerAffectation,
    getAffectationsByClasse,
    affectationEtablissement,
    getClassesEnseignant
}
