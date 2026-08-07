const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getAllEtablissements, getEtablissementById, updateEtablissement, updateStatus } = require('../../controllers/superAdmin/etablissement.controller');

router.get('/', verifyToken, requireSuperAdmin, getAllEtablissements);
router.get('/:id', verifyToken, requireSuperAdmin, getEtablissementById);
router.put('/:id', verifyToken, requireSuperAdmin, updateEtablissement);
router.patch('/:id/status', verifyToken, requireSuperAdmin, updateStatus);

module.exports = router;
