const { prisma } = require('../../lib/prisma');

const getAllDirecteurs = async (req, res) => {
  try {
    const directeurs = await prisma.administrateur.findMany({
      include: {
        etablissement: {
          select: {
            id: true,
            nom: true,
            statut: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const payload = directeurs.map((item) => ({
      id: item.id,
      nom: `${item.prenom} ${item.nom}`.trim(),
      prenom: item.prenom,
      email: item.email,
      telephone: '—',
      etablissement: item.etablissement?.nom || 'Aucun établissement',
      statut: item.etablissement?.statut || 'inactif',
      initials: `${item.prenom?.charAt(0) || ''}${item.nom?.charAt(0) || ''}`.toUpperCase()
    }));

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des directeurs' });
  }
};

module.exports = { getAllDirecteurs };
