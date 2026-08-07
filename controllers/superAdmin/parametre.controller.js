const { getPlatformSettings, savePlatformSettings } = require('../../utils/superAdminHelpers');

const getParametres = async (req, res) => {
  try {
    return res.status(200).json(getPlatformSettings());
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la récupération des paramètres' });
  }
};

const updateParametres = async (req, res) => {
  try {
    const updated = savePlatformSettings(req.body);
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Erreur lors de la mise à jour des paramètres' });
  }
};

module.exports = { getParametres, updateParametres };
