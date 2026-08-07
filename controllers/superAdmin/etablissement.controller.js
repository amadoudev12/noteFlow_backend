const { prisma } = require('../../lib/prisma');
const { appendSuperAdminLog } = require('../../utils/superAdminHelpers');

const normalizeEtablissementType = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (['public', 'publique'].includes(raw)) return 'Public';
  if (['prive', 'privé', 'privee', 'privée'].includes(raw)) return 'Privé';
  if (['professionnel', 'professionnelle'].includes(raw)) return 'Professionnel';
  if (['universite', 'université', 'universitaire'].includes(raw)) return 'Université';
  return 'Public';
};

const normalizeStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (['actif', 'active', 'ouvert', 'ouvertes'].includes(raw)) return 'actif';
  if (['inactif', 'inactive', 'ferme', 'fermée'].includes(raw)) return 'inactif';
  if (['suspendu', 'suspendue', 'bloque', 'bloquée'].includes(raw)) return 'suspendu';
  if (['archive', 'archivee', 'archivé', 'archivée'].includes(raw)) return 'archivee';
  return 'actif';
};

const getAllEtablissements = async (req, res) => {
  try {
    const etablissements = await prisma.etablissement.findMany({
      select: {
        id: true,
        nom: true,
        adresse: true,
        phone: true,
        email: true,
        code: true,
        statut: true,
        typeEtablissement: true,
        createdAt: true,
        directeur: true,
        Administrateur: {
          select: {
            prenom: true,
            nom: true,
            email: true
          }
        },
        _count: {
          select: {
            inscription: true,
            classe: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const payload = etablissements.map((item) => ({
      id: item.id,
      nom: item.nom,
      adresse: item.adresse,
      ville: item.adresse?.split(',')[0] || item.adresse || '—',
      phone: item.phone || '—',
      email: item.email || '—',
      code: item.code,
      statut: normalizeStatus(item.statut),
      type: normalizeEtablissementType(item.typeEtablissement || item.type),
      directeur: item.directeur || `${item.Administrateur?.prenom || ''} ${item.Administrateur?.nom || ''}`.trim() || '—',
      directeurEmail: item.Administrateur?.email || '—',
      dateCreation: item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—',
      eleves: item._count?.inscription || 0,
      classes: item._count?.classe || 0
    }));

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des établissements' });
  }
};

const getEtablissementById = async (req, res) => {
  const { id } = req.params;
  try {
    const etablissement = await prisma.etablissement.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        nom: true,
        adresse: true,
        phone: true,
        email: true,
        code: true,
        statut: true,
        typeEtablissement: true,
        createdAt: true,
        directeur: true,
        Administrateur: {
          select: {
            prenom: true,
            nom: true,
            email: true
          }
        }
      }
    });

    if (!etablissement) return res.status(404).json({ message: 'Établissement introuvable' });

    return res.status(200).json({
      id: etablissement.id,
      nom: etablissement.nom,
      adresse: etablissement.adresse,
      phone: etablissement.phone || '—',
      email: etablissement.email || '—',
      code: etablissement.code,
      statut: normalizeStatus(etablissement.statut),
      type: normalizeEtablissementType(etablissement.typeEtablissement || etablissement.type),
      directeur: etablissement.directeur || `${etablissement.Administrateur?.prenom || ''} ${etablissement.Administrateur?.nom || ''}`.trim() || '—',
      directeurEmail: etablissement.Administrateur?.email || '—'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération de l’établissement' });
  }
};

const updateEtablissement = async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  try {
    const updated = await prisma.etablissement.update({
      where: { id: Number(id) },
      data: {
        nom: body.nom,
        adresse: body.adresse,
        phone: body.phone,
        email: body.email,
        code: body.code,
        statut: body.statut,
        typeEtablissement: body.typeEtablissement || body.type || 'PUBLIC',
        directeur: body.directeur
      }
    });

    appendSuperAdminLog('Modification établissement', `Mise à jour de l’établissement ${updated.nom}`, req.user?.nom || 'Super Admin');
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la modification de l’établissement' });
  }
};

const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  try {
    const updated = await prisma.etablissement.update({
      where: { id: Number(id) },
      data: { statut }
    });

    appendSuperAdminLog('Changement de statut établissement', `Établissement ${updated.nom} passé à ${statut}`, req.user?.nom || 'Super Admin');
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors du changement de statut' });
  }
};

module.exports = {
  getAllEtablissements,
  getEtablissementById,
  updateEtablissement,
  updateStatus
};
