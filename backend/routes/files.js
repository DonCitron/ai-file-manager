// File Routes
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');

// Access to db and fileService will be passed in from server.js
let db, fileService;
function setDbAndService(database, service) { db = database; fileService = service; }

// Multer-Konfiguration für Dateiuploads (reuse from server.js)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedOriginalName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const blockedTypes = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blockedTypes.includes(ext)) return cb(new Error('Dieser Dateityp ist nicht erlaubt'));
    cb(null, true);
  }
});

// Upload
router.post('/upload', authMiddleware, upload.array('files'), asyncHandler((req, res) => fileController.upload(req, res, fileService)));
// Get files
router.get('/files', authMiddleware, asyncHandler((req, res) => fileController.getFiles(req, res, fileService)));
// AI search
router.post('/ai-search', authMiddleware, validationRules.search, handleValidationErrors, asyncHandler((req, res) => fileController.aiSearch(req, res, fileService)));
// Alias for AI search
router.post('/search', (req, res, next) => { req.url = '/ai-search'; next(); });
// Download
router.get('/download/:filename', authMiddleware, asyncHandler((req, res) => fileController.download(req, res, db)));
// Delete file
router.delete('/files/:id', authMiddleware, asyncHandler((req, res) => fileController.deleteFile(req, res, fileService)));
// User stats
router.get('/user/stats', authMiddleware, asyncHandler((req, res) => fileController.getUserStats(req, res, fileService)));
// Duplicates
router.get('/duplicates', authMiddleware, asyncHandler((req, res) => fileController.findDuplicates(req, res, db)));
// Find similar
router.post('/find-similar', authMiddleware, asyncHandler((req, res) => fileController.findSimilar(req, res, db, fileService)));
// Admin users
router.get('/admin/users', authMiddleware, adminMiddleware, asyncHandler((req, res) => fileController.adminGetUsers(req, res, db)));
// Preview (static files)
router.use('/preview', authMiddleware, (req, res, next) => fileController.previewFile(req, res, db));

module.exports = { router, setDbAndService };
