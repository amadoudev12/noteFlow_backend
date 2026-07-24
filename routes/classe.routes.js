const express = require('express')
const { listeEleveParClasse, InfoClasseController,  listeClasses, listeClasseByEtabblissement,getClasseMatiere, createClasse, updateClasse, deleteClasse, moyenneClasseController, classeStatController, moyenneMatiereClasseController, repartitionNoterClasseController } = require('../controllers/classe.controller')
const route = express.Router()
const VerifyToken = require('../middleware/verifyToken')


route.get('/liste-des-classes', listeClasses)
route.get('/etablissement/classe',VerifyToken, listeClasseByEtabblissement)
route.post('/create', VerifyToken, createClasse)
route.get('/classe-matiere/:id', VerifyToken, getClasseMatiere)
route.get('/:id',InfoClasseController)
// route.get('/moyenne-classe/:id', moyenneClasseController)
route.get('/liste-classe/:id', listeEleveParClasse)
route.put('/update/:id', VerifyToken, updateClasse)
route.delete('/delete/:id', VerifyToken, deleteClasse)
route.get('/stat-classe/:id',classeStatController)
route.get('/moyenne/matiere/:id', moyenneMatiereClasseController)
route.get('/repartition/notes/:id', repartitionNoterClasseController)
module.exports = route