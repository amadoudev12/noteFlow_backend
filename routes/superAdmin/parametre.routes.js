const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getParametres, updateParametres } = require('../../controllers/superAdmin/parametre.controller');

router.get('/', verifyToken, requireSuperAdmin, getParametres);
router.put('/', verifyToken, requireSuperAdmin, updateParametres);

module.exports = router;
