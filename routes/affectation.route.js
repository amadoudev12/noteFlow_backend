const express = require('express')
const { ajouterAffectation, affectationEtablissement } = require('../controllers/affectation.controller')
const verifyToken = require('../middleware/verifyToken')
const route = express.Router()

route.post('/create', verifyToken, ajouterAffectation)
route.get('/',verifyToken, affectationEtablissement)

module.exports = route