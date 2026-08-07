require('dotenv').config()
const path = require('path')
const express = require('express')
const activerTrimestreAutomatique = require('./utils/activerTrimestre')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const errorHandler = require('./middleware/errorHandler')
const logger = require('./lib/logger')

const app = express()
const port = process.env.PORT || 5000

// Sécurité - Helmet pour headers HTTP
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
)

// CORS - Restreindre aux domaines autorisés
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
}
app.use(cors(corsOptions))


// Rate limiting - Protection contre les attaques
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // Limite à 100 requêtes par fenêtre
//     message: 'Trop de requêtes, veuillez réessayer plus tard'
// })
// app.use(limiter)

// Middlewares de parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use("/uploads", express.static('uploads'))

// Logger pour chaque requête
app.use((req, res, next) => {
    logger.info(`[${req.method}] ${req.path}`, { ip: req.ip })
    next()
})

// Initialisation automatique du trimestre
activerTrimestreAutomatique()

// Routes
app.use('/eleves', require('./routes/eleves.route'))
app.use('/enseignants', require('./routes/enseignants.route'))
app.use('/user', require('./routes/user.route'))
app.use('/classe', require('./routes/classe.routes'))
app.use('/note', require('./routes/note.route'))
app.use('/trimestres', require('./routes/trimestres.route'))
app.use('/etablissements', require('./routes/etalisement.routes'))
app.use('/admin', require('./routes/admin.route'))
app.use('/bulletin', require('./routes/bulletin.route'))
app.use('/affectation', require("./routes/affectation.route"))
app.use('/matieres', require('./routes/matieres.route'))
app.use('/absences',require('./routes/absence.routes'))
app.use('/super-admin/etablissements', require('./routes/superAdmin/etablissement.routes'))
app.use('/super-admin/directeurs', require('./routes/superAdmin/directeur.routes'))
app.use('/super-admin/annees', require('./routes/superAdmin/anneeAcademique.routes'))
app.use('/super-admin/trimestres', require('./routes/superAdmin/trimestre.routes'))
app.use('/super-admin/statistiques', require('./routes/superAdmin/statistique.routes'))
app.use('/super-admin/logs', require('./routes/superAdmin/log.routes'))
app.use('/super-admin/parametres', require('./routes/superAdmin/parametre.routes'))
// Middleware d'erreur - doit être en dernier
app.use(errorHandler)

app.listen(port, () => {
    logger.info(`Serveur démarré sur le port ${port}`)
})