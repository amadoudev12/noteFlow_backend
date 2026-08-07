const { prisma } = require('../../lib/prisma');
const { appendSuperAdminLog, formatDate } = require('../../utils/superAdminHelpers');

const getAllTrimestres = async (req, res) => {
  try {
    const trimestres = await prisma.trimestre.findMany({
      orderBy: { id_trimestre: 'asc' }
    });

    const payload = trimestres.map((item) => ({
      id: item.id_trimestre,
      nom: item.libelle,
      debut: formatDate(item.date_debut),
      fin: formatDate(item.date_fin),
      progression: item.actif ? 62 : 0,
      statut: item.actif ? 'en cours' : 'a venir'
    }));

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des trimestres' });
  }
};

const createTrimestre = async (req, res) => {
  const body = req.body;
  try {
    const created = await prisma.trimestre.create({
      data: {
        libelle: body.libelle,
        date_debut: new Date(body.date_debut),
        date_fin: new Date(body.date_fin),
        actif: Boolean(body.actif)
      }
    });

    appendSuperAdminLog('Création trimestre', `Trimestre ${created.libelle} créé`, req.user?.nom || 'Super Admin');
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la création du trimestre' });
  }
};

const updateTrimestre = async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  try {
    const updated = await prisma.trimestre.update({
      where: { id_trimestre: Number(id) },
      data: {
        libelle: body.libelle,
        date_debut: new Date(body.date_debut),
        date_fin: new Date(body.date_fin),
        actif: body.actif
      }
    });

    appendSuperAdminLog('Modification trimestre', `Trimestre ${updated.libelle} mis à jour`, req.user?.nom || 'Super Admin');
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la modification du trimestre' });
  }
};

module.exports = {
  getAllTrimestres,
  createTrimestre,
  updateTrimestre
};
