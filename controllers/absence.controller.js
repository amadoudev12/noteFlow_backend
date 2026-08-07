const {prisma} = require("../lib/prisma");

exports.createAbsence = async (req, res) => {
  try {
    if (req.user?.user?.user?.role !== "ENSEIGNANT") {
      return res.status(403).json({
        message: "Vous n'êtes pas administrateur",
      });
    }

    const { affectationId, date, eleves } = req.body;
    const userId = req.user.user.id;

    if (!Array.isArray(eleves) || eleves.length === 0) {
      return res.status(400).json({
        message: "Aucun élève transmis",
      });
    }

    const STATUTS_VALIDES = ["ABSENT", "RETARD"];
    const statutInvalide = eleves.find(
      (e) => !STATUTS_VALIDES.includes(e.statut)
    );
    if (statutInvalide) {
      return res.status(400).json({
        message: `Statut invalide : ${statutInvalide.statut}`,
      });
    }

    // Vérifier que l'utilisateur possède cette affectation
    const affectation = await prisma.affectation.findFirst({
      where: {
        id: affectationId,
        compteInstitutionnel: {
          id: userId,
        },
      },
    });

    if (!affectation) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé pour cette matière",
      });
    }

    // Récupérer l'année active
    const annee = await prisma.anneeAcademique.findFirst({
      where: { actif: true },
    });

    if (!annee) {
      return res.status(400).json({
        message: "Aucune année académique active",
      });
    }

    // Récupérer le trimestre actif
    const trimestre = await prisma.trimestre.findFirst({
      where: { actif: true },
    });

    if (!trimestre) {
      return res.status(400).json({
        message: "Aucun trimestre actif",
      });
    }

    const matricules = eleves.map((e) => e.matricule);

    // Vérifier que les élèves appartiennent bien à la classe
    const inscriptions = await prisma.inscription.findMany({
      where: {
        id_classe: affectation.classeId,
        matricule_eleve: { in: matricules },
        id_annee_academique: annee.id,
      },
    });

    if (inscriptions.length !== matricules.length) {
      return res.status(400).json({
        message: "Certains élèves ne font pas partie de cette classe",
      });
    }

    // Création via une transaction
    const absences = await prisma.$transaction(
      eleves.map(({ matricule, statut }) =>
        prisma.absence.create({
          data: {
            eleveId: matricule,
            affectationId,
            anneeAcademiqueId: annee.id,
            trimestreId: trimestre.id_trimestre,
            date: new Date(date),
            statut,
            createdBy: userId,
          },
        })
      )
    );

    return res.status(201).json({
      message: "Absences enregistrées",
      data: absences,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};




exports.getAbsencesByClasse = async (req, res) => {
  try {
    const { classeId } = req.params;
    const { trimestreId } = req.query;
    console.log("trimestre",trimestreId)
    if (!classeId) {
      return res.status(400).json({
        message: "Classe obligatoire",
      });
    }

    const absences = await prisma.absence.findMany({
      where: {
        affectation: {
          classeId: Number(classeId),
        },
        ...(trimestreId && {
          trimestreId: Number(trimestreId),
        }),
      },
      include: {
        eleve: true,
        affectation: {
          include: {
            matiere: true,
            compteInstitutionnel: {
              include: {
                user: {
                  include: {
                    enseignant: true,
                  },
                },
              },
            },
          },
        },
        trimestre: true,
        anneeAcademique: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return res.json({
      message: "Liste des absences",
      data: absences,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};



exports.getAbsencesByEleve = async (req, res) => {
  try {
    const { matricule } = req.params;

    const absences = await prisma.absence.findMany({
      where: {
        eleveId: matricule,
      },
      include: {
        affectation: {
          include: {
            matiere: true,
          },
        },
        trimestre: true,
        anneeAcademique: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return res.json({
      message: "Absences élève",
      data: absences,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};


exports.getBilanAbsence = async (req, res) => {
  try {
    const { matricule } = req.params;

    const absences = await prisma.absence.findMany({
      where: {
        eleveId: matricule,
      },
    });

    const total = absences.length;
    const justifiees = absences.filter((a) => a.justifie === "oui").length;
    const retards = absences.filter((a) => a.statut === "RETARD").length;

    return res.json({
      totalAbsences: total,
      absencesJustifiees: justifiees,
      absencesNonJustifiees: total - justifiees,
      retards,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};


exports.getMesAbsences = async (req, res) => {
  try {
    // Compte institutionnel connecté
    const compteId = req.user.user.id;

    // Vérifier que le compte existe
    const compte = await prisma.compteInstitutionnel.findUnique({
      where: {
        id: compteId,
      },
      include:{
        user:{
          include:{
            eleve:true
          }
        }
      }
    });

    if (!compte) {
      return res.status(404).json({
        message: "Compte institutionnel introuvable",
      });
    }

    const absences = await prisma.absence.findMany({
      where: {
        eleveId:compte.user.eleve.matricule
      },
      include: {
        eleve: true,
        affectation: {
          include: {
            classe: true,
            matiere: true,
          },
        },
        trimestre: true,
        anneeAcademique: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return res.json({
      message: "Mes absences enregistrées",
      enseignant: {
        login: compte.login,
      },
      data: absences,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};