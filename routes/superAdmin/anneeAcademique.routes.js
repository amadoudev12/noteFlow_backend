const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getAllAnnees, createAnnee, activateAnnee } = require('../../controllers/superAdmin/anneeAcademique.controller');

router.get('/', verifyToken, requireSuperAdmin, getAllAnnees);
router.post('/create', verifyToken, requireSuperAdmin, createAnnee);
router.patch('/:id/active', verifyToken, requireSuperAdmin, activateAnnee);

module.exports = router;
