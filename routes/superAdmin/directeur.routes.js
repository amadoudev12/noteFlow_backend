const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getAllDirecteurs } = require('../../controllers/superAdmin/directeur.controller');

router.get('/', verifyToken, requireSuperAdmin, getAllDirecteurs);

module.exports = router;
