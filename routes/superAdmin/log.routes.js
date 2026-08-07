const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getLogs } = require('../../controllers/superAdmin/log.controller');

router.get('/', verifyToken, requireSuperAdmin, getLogs);

module.exports = router;
