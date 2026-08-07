const express = require('express');
const router = express.Router();
const verifyToken = require('../../middleware/verifyToken');
const requireSuperAdmin = require('../../middleware/requireSuperAdmin');
const { getAllTrimestres, createTrimestre, updateTrimestre } = require('../../controllers/superAdmin/trimestre.controller');

router.get('/', verifyToken, requireSuperAdmin, getAllTrimestres);
router.post('/create', verifyToken, requireSuperAdmin, createTrimestre);
router.put('/:id', verifyToken, requireSuperAdmin, updateTrimestre);

module.exports = router;
