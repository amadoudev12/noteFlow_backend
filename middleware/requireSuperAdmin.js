const { isSuperAdmin } = require('../utils/superAdminHelpers');

const requireSuperAdmin = (req, res, next) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  next();
};

module.exports = requireSuperAdmin;
