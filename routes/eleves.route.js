const express = require('express')
const { getAllElevesController, createEleveController, getEleveController, moyennesController, EleveRang, absenceController, getBulletin, createCertificat} = require('../controllers/eleves.controller')
const VerifyToken = require('../middleware/verifyToken')
const upload  = require('../middleware/uploadsFichier')
const route = express.Router()

route.get('/liste', getAllElevesController)
route.get('/rang',VerifyToken,EleveRang)
route.get('/certificat',VerifyToken,createCertificat)
route.post('/import', VerifyToken, upload.single('file'), createEleveController)
route.post('/bulletin',getBulletin)
route.post('/absence',absenceController)
route.get('/note-matiere/:id',moyennesController)
route.get('/:id',getEleveController)

module.exports = route