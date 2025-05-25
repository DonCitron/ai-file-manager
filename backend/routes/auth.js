// Auth Routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const rateLimit = require('express-rate-limit');

// Access to db will be passed in from server.js
let db;
function setDb(database) { db = database; }

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { error: 'Zu viele Anmeldeversuche, bitte versuchen Sie es später erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login
router.post('/login', loginLimiter, validationRules.login, handleValidationErrors, asyncHandler((req, res) => authController.login(req, res, db)));
// Verify session
router.get('/verify-session', authMiddleware, (req, res) => authController.verifySession(req, res));
// Request password reset
router.post('/request-password-reset', asyncHandler((req, res) => authController.requestPasswordReset(req, res, db)));
// Reset password
router.post('/reset-password', asyncHandler((req, res) => authController.resetPassword(req, res, db)));

module.exports = { router, setDb };
