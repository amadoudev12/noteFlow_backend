const { prisma } = require('../lib/prisma');

// The institution is always resolved from the signed-in institutional account.
// Never use an etablissementId supplied by the browser for tenant isolation.
async function getSchoolContext(req) {
  const compteId = req.user?.user?.id;
  if (!compteId) {
    const error = new Error('Authentification requise');
    error.status = 401;
    throw error;
  }
  const compte = await prisma.compteInstitutionnel.findUnique({
    where: { id: compteId },
    select: { id: true, userId: true, etablissementId: true, user: { select: { role: true } } }
  });
  if (!compte) {
    const error = new Error('Compte institutionnel introuvable');
    error.status = 401;
    throw error;
  }
  return compte;
}

async function getActiveSchoolYear(etablissementId) {
  return prisma.anneeAcademique.findFirst({
    where: { etablissementId, actif: true },
    orderBy: { date_debut: 'desc' }
  });
}

async function getActiveTerm(etablissementId, anneeAcademiqueId) {
  const annee = anneeAcademiqueId
    ? await prisma.anneeAcademique.findFirst({ where: { id: anneeAcademiqueId, etablissementId } })
    : await getActiveSchoolYear(etablissementId);
  if (!annee) return null;
  const now = new Date();
  return prisma.trimestre.findFirst({
    where: { anneeAcademiqueId: annee.id, OR: [{ actif: true }, { date_debut: { lte: now }, date_fin: { gte: now } }] },
    orderBy: [{ actif: 'desc' }, { ordre: 'asc' }]
  });
}

// Pour les routes identifiées par un matricule d'élève (et non par un compte
// institutionnel), l'établissement se déduit de l'élève lui-même plutôt que
// d'un etablissementId ambiant : chaque inscription porte sa propre année
// académique, donc chercher celle dont l'année est active revient à
// sélectionner automatiquement le bon établissement, sans dépendre de l'ordre
// de retour de la base quand plusieurs établissements ont chacun une année active.
async function getActiveInscriptionForEleve(matricule, extraInclude = {}) {
  const eleve = await prisma.eleve.findUnique({
    where: { matricule },
    include: {
      inscriptions: {
        include: { annee: true, ...extraInclude }
      }
    }
  });
  if (!eleve) return null;
  const inscription = eleve.inscriptions.find((i) => i.annee.actif === true);
  if (!inscription) return null;
  const { inscriptions, ...eleveSansInscriptions } = eleve;
  return { ...inscription, eleve: eleveSansInscriptions };
}

module.exports = { getSchoolContext, getActiveSchoolYear, getActiveTerm, getActiveInscriptionForEleve };
