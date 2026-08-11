const {prisma} = require("../lib/prisma");
const { getSchoolContext, getActiveSchoolYear, getActiveTerm } = require('../utils/schoolContext');

exports.createAbsence = async (req, res) => {
  try {
    if (req.user?.user?.user?.role !== "ENSEIGNANT") {
      return res.status(403).json({
        message: "Vous n'êtes pas administrateur",
      });
    }

    const { affectationId, date, eleves } = req.body;
    const context = await getSchoolContext(req);
    const userId = context.userId;

    const affectationIdNormalise = Number(affectationId);
    const dateAbsence = new Date(date);

    if (!Number.isInteger(affectationIdNormalise) || affectationIdNormalise <= 0) {
      return res.status(400).json({ message: "Affectation invalide" });
    }

    if (Number.isNaN(dateAbsence.getTime())) {
      return res.status(400).json({ message: "Date d'absence invalide" });
    }

    if (!Array.isArray(eleves) || eleves.length === 0) {
      return res.status(400).json({
        message: "Aucun élève transmis",
      });
    }

    const STATUTS_VALIDES = ["ABSENT", "RETARD"];
    const JUSTIFICATIONS_VALIDES = ["oui", "non"];
    const elevesNormalises = eleves.map((eleve) => ({
      ...eleve,
      // La durée appartient obligatoirement à l'élève concerné : il n'existe
      // volontairement aucun repli vers une durée envoyée pour tout l'appel.
      nombreHeures: eleve.nombreHeures,
      justifie: eleve.justifie ?? "non",
    }));
    const statutInvalide = elevesNormalises.find(
      (e) => !e.matricule || !STATUTS_VALIDES.includes(e.statut)
    );
    if (statutInvalide) {
      return res.status(400).json({
        message: `Statut invalide : ${statutInvalide.statut}`,
      });
    }

    const justificationInvalide = elevesNormalises.find(
      (eleve) => !JUSTIFICATIONS_VALIDES.includes(eleve.justifie)
    );
    if (justificationInvalide) {
      return res.status(400).json({ message: "Statut de justification invalide" });
    }

    const heuresInvalides = elevesNormalises.find((eleve) => {
      const heures = Number(eleve.nombreHeures);
      return !Number.isInteger(heures) || heures <= 0;
    });
    if (heuresInvalides) {
      return res.status(400).json({
        message: "Le nombre d'heures doit être un entier strictement positif",
      });
    }

    const matricules = elevesNormalises.map((e) => e.matricule);
    if (new Set(matricules).size !== matricules.length) {
      return res.status(400).json({ message: "Un élève ne peut être saisi qu'une fois" });
    }

    // Vérifier que l'utilisateur possède cette affectation
    const affectation = await prisma.affectation.findFirst({
      where: {
        id: affectationIdNormalise,
        compteInstitutionnelId: context.id,
        classe: { idEtablissement: context.etablissementId },
      },
    });

    if (!affectation) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé pour cette matière",
      });
    }

    // Récupérer l'année active
    const annee = await getActiveSchoolYear(context.etablissementId);

    if (!annee) {
      return res.status(400).json({
        message: "Aucune année académique active",
      });
    }

    // Récupérer le trimestre actif
    const trimestre = await getActiveTerm(context.etablissementId, annee.id);

    if (!trimestre) {
      return res.status(400).json({
        message: "Aucun trimestre actif",
      });
    }

    // Vérifier que les élèves appartiennent bien à la classe
    const inscriptions = await prisma.inscription.findMany({
      where: {
        id_classe: affectation.classeId,
        matricule_eleve: { in: matricules },
        id_annee_academique: annee.id,
        id_etablissement: context.etablissementId,
      },
    });

    if (inscriptions.length !== matricules.length) {
      return res.status(400).json({
        message: "Certains élèves ne font pas partie de cette classe",
      });
    }

    // Création via une transaction
    const absences = await prisma.$transaction(
      elevesNormalises.map(({ matricule, statut, nombreHeures, justifie }) =>
        prisma.absence.create({
          data: {
            eleveId: matricule,
            affectationId: affectationIdNormalise,
            anneeAcademiqueId: annee.id,
            trimestreId: trimestre.id_trimestre,
            date: dateAbsence,
            nombreHeures: Number(nombreHeures),
            statut,
            justifie,
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
    const { trimestreId, anneeAcademiqueId } = req.query;

    const absences = await prisma.absence.findMany({
      where: {
        eleveId: matricule,
        ...(trimestreId && { trimestreId: Number(trimestreId) }),
        ...(anneeAcademiqueId && { anneeAcademiqueId: Number(anneeAcademiqueId) }),
      },
    });

    const totalHeures = absences.reduce((total, absence) => total + (absence.nombreHeures ?? 1), 0);
    const heuresJustifiees = absences
      .filter((absence) => absence.justifie === "oui")
      .reduce((total, absence) => total + (absence.nombreHeures ?? 1), 0);
    const retards = absences.filter((a) => a.statut === "RETARD").length;
    const absencesCount = absences.filter((a) => a.statut === "ABSENT").length;

    return res.json({
      totalAbsences: absencesCount,
      retards,
      totalHeures,
      heuresJustifiees,
      heuresNonJustifiees: totalHeures - heuresJustifiees,
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
