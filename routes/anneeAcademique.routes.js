const router = require('express').Router();
const verifyToken = require('../middleware/verifyToken');
const controller = require('../controllers/anneeAcademique.controller');
router.use(verifyToken);
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.patch('/:id/active', controller.activate);
module.exports = router;
