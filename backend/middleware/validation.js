const { body, validationResult } = require('express-validator');

/**
 * Validierungsregeln für verschiedene Endpunkte
 */
const validationRules = {
  // Login Validierung
  login: [
    body('username')
      .trim()
      .notEmpty().withMessage('Benutzername ist erforderlich')
      .isLength({ min: 3, max: 30 }).withMessage('Benutzername muss zwischen 3 und 30 Zeichen lang sein')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten'),
    body('password')
      .notEmpty().withMessage('Passwort ist erforderlich')
      .isLength({ min: 6 }).withMessage('Passwort muss mindestens 6 Zeichen lang sein')
  ],

  // Registrierung Validierung
  register: [
    body('username')
      .trim()
      .notEmpty().withMessage('Benutzername ist erforderlich')
      .isLength({ min: 3, max: 30 }).withMessage('Benutzername muss zwischen 3 und 30 Zeichen lang sein')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten'),
    body('password')
      .notEmpty().withMessage('Passwort ist erforderlich')
      .isLength({ min: 6 }).withMessage('Passwort muss mindestens 6 Zeichen lang sein')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Passwort muss mindestens einen Kleinbuchstaben, einen Großbuchstaben und eine Zahl enthalten'),
    body('email')
      .optional()
      .isEmail().withMessage('Ungültige E-Mail-Adresse')
      .normalizeEmail()
  ],

  // Dateisuche Validierung
  search: [
    body('query')
      .trim()
      .notEmpty().withMessage('Suchanfrage ist erforderlich')
      .isLength({ min: 2, max: 100 }).withMessage('Suchanfrage muss zwischen 2 und 100 Zeichen lang sein')
      .escape() // HTML-Escape zur Vermeidung von XSS
  ],

  // Datei-Upload Validierung (für Metadaten)
  fileUpload: [
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Beschreibung darf maximal 500 Zeichen lang sein')
      .escape(),
    body('tags')
      .optional()
      .isArray().withMessage('Tags müssen ein Array sein')
      .custom((tags) => {
        if (tags.length > 20) {
          throw new Error('Maximal 20 Tags erlaubt');
        }
        return true;
      })
  ]
};

/**
 * Middleware zur Überprüfung von Validierungsfehlern
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validierungsfehler',
      message: 'Die eingegebenen Daten sind ungültig',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

/**
 * Hilfsfunktion zur Bereinigung von Benutzereingaben
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Entfernt potentiell gefährliche Zeichen
  return input
    .replace(/[<>]/g, '') // Entfernt < und >
    .replace(/javascript:/gi, '') // Entfernt javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Entfernt Event-Handler wie onclick=
    .trim();
};

/**
 * Middleware zur allgemeinen Input-Bereinigung
 */
const sanitizeMiddleware = (req, res, next) => {
  // Bereinige req.body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }

  // Bereinige req.query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    });
  }

  // Bereinige req.params
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    });
  }

  next();
};

module.exports = {
  validationRules,
  handleValidationErrors,
  sanitizeInput,
  sanitizeMiddleware
};
