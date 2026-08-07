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
            const prenomSanitized = enseignant.prenom
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/\s+/g, "")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "")
            const etabSanitized = etablissement.nom
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/\s+/g, "")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "")
            const login = `${prenomSanitized}@${etabSanitized}.edu`
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
            
            let userId;
            let user 
            if (!enseignantExist) {
                user = await prisma.user.create({
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
                userId = user.id;
                await prisma.enseignantEtablissement.create(({
                    data : {
                        enseignant_id:enseignantCree.matricule,
                        etablissement_id:idEtablissement
                    }
                }))
            } else {
                userId = enseignantExist.userId;
            }

            const compte = await prisma.compteInstitutionnel.findFirst({
                where : {
                    userId:userId,
                    etablissement:{
                        id:idEtablissement
                    }
                }
            })

            if(compte){
                return res.status(409).json({message:'Cet enseignant possede deja un compte dans cet etablissement'})
            }

            // creation du compte 
            const compteI = await prisma.compteInstitutionnel.create({
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
                                id:etablissement.id
                            }
                        }
                }
            })
            await sendEmail(enseignant.nom, enseignant.email, compteI.login, compteI.login)
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

const getEnseignantByCompteIdController = async(req,res)=>{

    const compteId = req.user.user.id;

    try{

        const compte = await prisma.compteInstitutionnel.findUnique({

            where:{
                id:compteId
            },

            include:{

                user:{
                    include:{
                        enseignant:true
                    }
                },

                etablissement:true,

                affectations:{
                    include:{
                        classe:true,
                        matiere:true,
                        anneeAcademique:true
                    }
                }

            }

        });



        if(!compte || !compte.user.enseignant){

            return res.status(404).json({
                message:"Enseignant non trouvé"
            });

        }



        return res.status(200).json({

            enseignant:compte.user.enseignant,

            etablissement:compte.etablissement,

            affectations:compte.affectations

        });


    }catch(err){

        console.error(err);

        res.status(500).json({
            message:"Erreur serveur"
        });

    }

}

const classeEnseignerParEnsignant = async (req, res) => {
  // 1. Vérification du rôle
  if (req.user?.user?.user?.role !== "ENSEIGNANT") {
    return res.status(403).json({
      message: "Vous n'êtes pas professeur",
    });
  }

  const compteId = req.user.user.id;

  try {
    // 2. Récupération des affectations pour l'année active
    const affectations = await prisma.affectation.findMany({
      where: {
        compteInstitutionnelId: compteId,
        anneeAcademique: {
          actif: true,
        },
      },
      include: {
        classe: true,
        matiere: true,
      },
    });

    if (affectations.length === 0) {
      return res.status(404).json({
        message: "Aucune affectation trouvée",
      });
    }

    // 3. Formatage du résultat
    const resultat = affectations.map((a) => ({
      id:a.id,
      classe: a.classe,
      matiere: {
        id: a.matiere.id,
        nom: a.matiere.nom,
      },
    }));
    console.log(resultat)
    // 4. Envoi de la réponse
    return res.json(resultat);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};


const enseignantStatController = async (req, res) => {
  try {
    // 1. Vérification du rôle
    if (req.user?.user?.user?.role !== "ENSEIGNANT") {
      return res.status(403).json({
        message: "Vous n'êtes pas professeur",
      });
    }

    const compteId = req.user.user.id;

    // 2. Récupération des affectations de l'année active
    const affectations = await prisma.affectation.findMany({
      where: {
        compteInstitutionnelId: compteId,
        anneeAcademique: {
          actif: true,
        },
      },
    });

    // 3. Extraction des IDs uniques pour les classes et matières
    const classeIds = [...new Set(affectations.map((a) => a.classeId))];
    const nombreClasse = classeIds.length;
    
    const nombreMatiere = new Set(affectations.map((a) => a.matiereId)).size;

    // 4. Calcul du nombre total d'élèves inscrits dans ces classes
    const nombreEleve = await prisma.inscription.count({
      where: {
        id_classe: {
          in: classeIds,
        },
      },
    });

    // 5. Envoi des statistiques
    return res.json({
      nombreClasse,
      nombreEleve,
      nombreMatiere,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};


const nombreElevesClasse = async (req, res) => {
  // 1. Vérification du rôle
  if (req.user?.user?.user?.role !== "ENSEIGNANT") {
    return res.status(403).json({
      message: "Vous n'êtes pas professeur",
    });
  }

  try {
    const compteId = req.user.user.id;

    // 2. Récupération de l'année académique active
    const annee = await prisma.anneeAcademique.findFirst({
      where: { actif: true },
    });

    if (!annee) {
      return res.status(404).json({
        message: "Aucune année académique active trouvée",
      });
    }

    // 3. Récupération des affectations pour l'enseignant connecté
    const affectations = await prisma.affectation.findMany({
      where: {
        compteInstitutionnelId: compteId,
        anneeAcademiqueId: annee.id,
      },
      include: {
        classe: true,
      },
    });

    // 4. Extraction des classes uniques
    const classes = [
      ...new Map(affectations.map((a) => [a.classe.id, a.classe])).values(),
    ];

    // 5. Calcul de l'effectif de chaque classe en parallèle
    const resultat = await Promise.all(
      classes.map(async (classe) => {
        const effectif = await prisma.inscription.count({
          where: {
            id_classe: classe.id,
            id_annee_academique: annee.id,
          },
        });

        return {
          name: classe.libelle,
          effectif,
        };
      })
    );
    console.log(resultat)
    // 6. Envoi de la réponse
    return res.json(resultat);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

module.exports = {
    createEnseignantController, 
    getEnseignantByCompteIdController, 
    classeEnseignerParEnsignant,
    enseignantStatController,
    enseignantEtablissement,
    nombreElevesClasse
}