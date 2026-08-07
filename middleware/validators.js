const { body, param, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Données invalides',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Validations pour le login
const loginValidation = [
    body('login')
        .trim()
        .notEmpty().withMessage('Login requis')
        .isLength({ min: 3 }).withMessage('Login min 3 caractères'),
    body('mot_passe')
        .notEmpty().withMessage('Mot de passe requis')
        .isLength({ min: 4 }).withMessage('Mot de passe min 6 caractères'),
    handleValidationErrors
];

// Validations pour modification utilisateur
const modificationUserValidation = [
    body('password')
        .notEmpty().withMessage('Mot de passe requis')
        .isLength({ min: 8 }).withMessage('Mot de passe min 8 caractères'),
    handleValidationErrors
];

// Validations pour créer une note
const createNoteValidation = [
    body('config').notEmpty().withMessage('Config requise'),
    body('config.matiere').trim().notEmpty().withMessage('Matière requise'),
    body('config.type').trim().notEmpty().withMessage('Type d\'évaluation requis'),
    body('config.coefficient')
        .isFloat({ min: 0, max: 5 }).withMessage('Coefficient entre 0 et 5'),
    body('notes')
        .isArray().withMessage('Notes doit être un tableau'),
    body('notes.*.matricule')
        .trim()
        .notEmpty().withMessage('Matricule requis'),
    body('notes.*.note')
        .isFloat({ min: 0, max: 20 }).withMessage('Note entre 0 et 20'),
    handleValidationErrors
];

// Validations pour récupérer notes par classe/matière
const getNotesValidation = [
    body('id_classe')
        .isInt().withMessage('ID classe invalide'),
    body('id_matiere')
        .isInt().withMessage('ID matière invalide'),
    handleValidationErrors
];

module.exports = {
    loginValidation,
    modificationUserValidation,
    createNoteValidation,
    getNotesValidation,
    handleValidationErrors
};
