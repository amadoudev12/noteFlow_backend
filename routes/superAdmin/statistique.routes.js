const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getStatistiques } = require('../../controllers/superAdmin/statistique.controller');

router.get('/', verifyToken, requireSuperAdmin, getStatistiques);

module.exports = router;
