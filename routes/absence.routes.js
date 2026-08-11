const { createAbsence, getAbsencesByClasse, getMesAbsences, getBilanAbsence } = require('../controllers/absence.controller');
const verifyToken = require('../middleware/verifyToken')
const route=require("express").Router();

route.post(
    "/create",
    verifyToken,
    createAbsence
);

route.get(
    '/classe/:classeId',
    verifyToken,
    getAbsencesByClasse
)

route.get(
    '/eleve/:matricule/bilan',
    verifyToken,
    getBilanAbsence
)

route.get(
    "/mes-absences",
    verifyToken,
    getMesAbsences
);

module.exports=route
