const express = require('express')
const { postNote, getNotesByElveId, getAllNotesByClasseByMatier, noteRepartition, getAllNotesByMatiere } = require('../controllers/note.controller')
const verifyToken = require('../middleware/verifyToken')
const { createNoteValidation, getNotesValidation } = require('../middleware/validators')

const route = express.Router()

route.post('/create-note', verifyToken, createNoteValidation, postNote)
route.post('/liste-note', verifyToken, getNotesValidation, getAllNotesByClasseByMatier)
route.get('/repartition-note', verifyToken, noteRepartition)
route.post('/eleves/notes', verifyToken, getNotesValidation, getAllNotesByMatiere)
route.get('/getNote/:id', verifyToken, getNotesByElveId)
module.exports = route
