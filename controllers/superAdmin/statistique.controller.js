const { prisma } = require('../../lib/prisma');

const getStatistiques = async (req, res) => {
  try {
    const [totalEtablissements, etablissementsActifs, directeurs, enseignants, eleves, anneeActive, etablissements] = await Promise.all([
      prisma.etablissement.count(),
      prisma.etablissement.count({ where: { statut: 'actif' } }),
      prisma.administrateur.count(),
      prisma.enseignant.count(),
      prisma.eleve.count(),
      prisma.anneeAcademique.findFirst({ where: { actif: true }, select: { libelle: true } }),
      prisma.etablissement.findMany({
        select: {
          createdAt: true,
          typeEtablissement: true
        }
      })
    ]);

    const growthByMonth = etablissements.reduce((acc, etab) => {
      const month = new Date(etab.createdAt).toLocaleString('fr-FR', { month: 'short' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const croissance = Object.entries(growthByMonth)
      .sort(([a], [b]) => new Date(`2026 ${a}`).getTime() - new Date(`2026 ${b}`).getTime())
      .map(([mois, count]) => ({ mois, etablissements: count }));

    const repartition = Object.entries(
      etablissements.reduce((acc, etab) => {
        const type = etab.typeEtablissement || 'PUBLIC';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    ).map(([type, nombre]) => ({
      type,
      nombre,
      name: type,
      value: nombre,
      color: type === 'PUBLIC' ? '#2563eb' : type === 'PRIVE' ? '#16a34a' : type === 'PROFESSIONNEL' ? '#f97316' : '#94a3b8'
    }));

    return res.status(200).json({
        totalEtablissements,
        etablissementsActifs,
        directeurs,
        enseignants,
        eleves,
        anneeActive: anneeActive?.libelle || 'Aucune',
        croissanceEtablissements: croissance,
        croissance,
        repartitionEtablissements: repartition,
        repartition,
        activiteHebdo: [
            { jour: 'Lun', connexions: 120 },
            { jour: 'Mar', connexions: 180 },
            { jour: 'Mer', connexions: 150 },
            { jour: 'Jeu', connexions: 200 },
            { jour: 'Ven', connexions: 220 },
            { jour: 'Sam', connexions: 90 },
            { jour: 'Dim', connexions: 70 }
        ]
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
};

module.exports = { getStatistiques };
