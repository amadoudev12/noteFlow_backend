const { readSuperAdminLogs } = require('../../utils/superAdminHelpers');

const getLogs = async (req, res) => {
  try {
    const logs = readSuperAdminLogs().map((item, index) => ({
      id: item.id || index + 1,
      action: item.action,
      description: item.description,
      utilisateur: item.user,
      date: new Date(item.date).toLocaleString('fr-FR'),
      statut: 'success'
    }));

    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
  }
};

module.exports = { getLogs };
