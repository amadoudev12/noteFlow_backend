const express = require('express')
const { getTrimestres, postTrimestreController, updateTrimestre, actifTrimestreController, deleteTrimestre, getTrimestreActive } = require('../controllers/trimestre.controller')
const VerifyToken = require('../middleware/verifyToken')
const route = express.Router()

route.get('/', VerifyToken, getTrimestres)
route.get('/active', VerifyToken, getTrimestreActive)
route.post('/create',VerifyToken, postTrimestreController)
route.patch('/:id', VerifyToken, updateTrimestre)
route.patch('/actif/:id', VerifyToken, actifTrimestreController)
route.delete('/delete/:id',VerifyToken,deleteTrimestre)

module.exports = route
