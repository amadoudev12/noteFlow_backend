const express = require('express')
const VerifyToken = require('../middleware/verifyToken')
const {
    getAnneesArchive,
    getTrimestresArchive,
    getTrimestreDetailArchive,
    getClasseResultatsArchive,
    getEleveTrimestreArchive,
    getEleveHistoriqueArchive,
} = require('../controllers/archives.controller')

const route = express.Router()

// Module 100% lecture seule : uniquement des GET, protégés par authentification
// + contrôle du rôle ADMIN (fait dans le controller, comme le reste du projet).
route.get('/annees', VerifyToken, getAnneesArchive)
route.get('/annees/:anneeId/trimestres', VerifyToken, getTrimestresArchive)
route.get('/annees/:anneeId/trimestres/:trimestreId', VerifyToken, getTrimestreDetailArchive)
route.get('/trimestres/:trimestreId/classes/:classeId', VerifyToken, getClasseResultatsArchive)
route.get('/eleves/:matricule/trimestres/:trimestreId', VerifyToken, getEleveTrimestreArchive)
route.get('/eleves/:matricule', VerifyToken, getEleveHistoriqueArchive)

module.exports = route
