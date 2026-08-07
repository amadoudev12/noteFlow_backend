const express = require('express')
const { StatEtablissement, listePlusFaiblesMoyennes, listePlusFortesMoyennes, meilleureByClasseController, register, NombreEleveFaiblesByClasseController, NombreEleveFortByClasseController, mauvaisByClasseController } = require('../controllers/admin.controller')
const verifyToken = require('../middleware/verifyToken')
const uploadSignature = require('../middleware/UploadSignature')
const route = express.Router()

route.post('/register', uploadSignature.none(), register)

route.get('/stat',verifyToken, StatEtablissement)

route.get('/liste-faible-moyenne',verifyToken, listePlusFaiblesMoyennes)

route.get('/liste-forte-moyenne',verifyToken, listePlusFortesMoyennes)

route.get('/nombreElevesFaible',verifyToken, NombreEleveFaiblesByClasseController)

route.get('/nombreElevesFort',verifyToken, NombreEleveFortByClasseController)

route.get('/cinq-meilleurByclasse',verifyToken, meilleureByClasseController)

route.get('/mauvais-eleves-classe', verifyToken, mauvaisByClasseController)


module.exports = route