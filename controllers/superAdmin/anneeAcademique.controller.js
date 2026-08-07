const { prisma } = require('../../lib/prisma');
const { appendSuperAdminLog, formatDate } = require('../../utils/superAdminHelpers');

const getAllAnnees = async (req, res) => {
  try {
    const annees = await prisma.anneeAcademique.findMany({
      orderBy: { id: 'desc' }
    });

    const payload = annees.map((item) => ({
      id: item.id,
      libelle: item.libelle,
      statut: item.actif ? 'active' : 'archivee',
      etablissements: 0,
      debut: formatDate(item.date_debut),
      fin: formatDate(item.date_fin)
    }));

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des années académiques' });
  }
};

const createAnnee = async (req, res) => {
  const body = req.body;
  try {
    await prisma.anneeAcademique.updateMany({
      data: { actif: false }
    });

    const created = await prisma.anneeAcademique.create({
      data: {
        libelle: body.libelle,
        date_debut: new Date(body.date_debut),
        date_fin: new Date(body.date_fin),
        actif: body.actif !== false
      }
    });

    appendSuperAdminLog('Création année académique', `Année ${created.libelle} créée`, req.user?.nom || 'Super Admin');
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la création de l’année académique' });
  }
};

const activateAnnee = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.anneeAcademique.updateMany({
      data: { actif: false }
    });

    const updated = await prisma.anneeAcademique.update({
      where: { id: Number(id) },
      data: { actif: true }
    });

    appendSuperAdminLog('Activation année académique', `Année ${updated.libelle} activée`, req.user?.nom || 'Super Admin');
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de l’activation de l’année académique' });
  }
};

module.exports = {
  getAllAnnees,
  createAnnee,
  activateAnnee
};
