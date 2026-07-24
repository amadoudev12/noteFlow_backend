const express = require('express')
const { createEnseignantController, getEnseignantByCompteIdController, classeEnseignerParEnsignant, enseignantStatController, enseignantEtablissement, nombreMatiereController, nombreElevesClasse } = require('../controllers/enseignant.controller')
const VerifyToken = require('../middleware/verifyToken')
const upload = require('../middleware/uploadsFichier')
const route = express.Router()

route.get('/etablissement', VerifyToken, enseignantEtablissement)
route.post('/get-enseignant', VerifyToken, getEnseignantByCompteIdController)
route.get('/classe-enseigner',VerifyToken, classeEnseignerParEnsignant)
route.get('/stat',VerifyToken, enseignantStatController)
route.get('/nombre-eleves-classes', VerifyToken, nombreElevesClasse)
route.post('/create',upload.single('file') ,VerifyToken,createEnseignantController)
module.exports = route