// Umgebungsvariablen laden
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const Busboy = require('busboy');

// Optional Redis
let redis;
try {
  redis = require('redis');
} catch (e) {
  console.log('Redis module not available - continuing without Redis');
}

// Middleware importieren
const { authMiddleware, adminMiddleware, generateToken } = require('./middleware/auth');
const { validationRules, handleValidationErrors, sanitizeMiddleware } = require('./middleware/validation');
const { errorHandler, notFoundHandler, asyncHandler, requestLogger } = require('./middleware/errorHandler');

// Services importieren
const passwordService = require('./services/passwordService');
const FileService = require('./services/fileService');
const { analyzeFileWithGemini, detectSimilarFiles, generateDuplicateGroupId } = require('./geminiService');
const { uploadToR2, getDownloadUrl, testR2Connection } = require('./r2Service');

const { router: filesRouter, setDbAndService: setFilesDbAndService } = require('./routes/files');

const app = express();
const port = process.env.PORT || 3000;

// SQLite Datenbank initialisieren
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Fehler beim Verbinden mit der SQLite-Datenbank:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Erfolgreich mit der SQLite-Datenbank verbunden.');
    initializeDatabase();
  }
});

// FileService initialisieren
const fileService = new FileService(db, redisClient);

// Middleware Setup
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeMiddleware);
app.use(requestLogger);

// Multer-Konfiguration für Dateiuploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Sichere Dateinamen generieren
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + sanitizedOriginalName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10 // Maximal 10 Dateien gleichzeitig
  },
  fileFilter: (req, file, cb) => {
    // Gefährliche Dateitypen blockieren
    const blockedTypes = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (blockedTypes.includes(ext)) {
      return cb(new Error('Dieser Dateityp ist nicht erlaubt'));
    }
    
    cb(null, true);
  }
});

// Enforce secure environment variables in production
const bcryptRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your-secret-key-change-this-in-production') {
    console.error('❌ FATAL: JWT_SECRET must be set to a secure value in production!');
    process.exit(1);
  }
  if (bcryptRounds < 10) {
    console.error('❌ WARNING: BCRYPT_SALT_ROUNDS should be at least 10 in production! Using fallback value.');
  }
}

// In-memory store for failed login attempts and lockouts
const failedLoginAttempts = {};
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// In-memory store for password reset tokens
const passwordResetTokens = {};
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

let redisClient = null;
if (redis && process.env.REDIS_URL) {
  (async () => {
    try {
      redisClient = redis.createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) => console.warn('Redis Client Error:', err));
      await redisClient.connect();
      console.log('✅ Redis verbunden');
    } catch (error) {
      console.warn('⚠️ Redis Verbindung fehlgeschlagen - fortfahren ohne Redis');
      redisClient = null;
    }
  })();
} else {
  console.log('Redis not configured (REDIS_URL not set). Continuing without Redis.');
}

// Datenbank initialisieren
async function initializeDatabase() {
  // Tabellen erstellen
  const tables = [
    `CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      originalName TEXT,
      type TEXT,
      size INTEGER,
      path TEXT,
      r2ObjectKey TEXT,
      tags TEXT,
      uploadDate TEXT,
      description TEXT,
      aiAnalysis TEXT,
      contentHash TEXT,
      duplicateGroup TEXT,
      storageType TEXT DEFAULT 'local',
      userId INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      lastLogin TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS global_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      username TEXT,
      message TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS private_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER,
      receiverId INTEGER,
      message TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const tableSQL of tables) {
    await new Promise((resolve, reject) => {
      db.run(tableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // FileService Verzeichnisse initialisieren
  await fileService.initializeDirectories();
  console.log('✅ Verzeichnisse initialisiert');

  // R2 Verbindung testen
  try {
    const r2Connected = await testR2Connection();
    if (r2Connected) {
      console.log('✅ Cloudflare R2 Verbindung erfolgreich');
    } else {
      console.warn('⚠️ Cloudflare R2 Verbindung fehlgeschlagen - verwende lokalen Speicher');
    }
  } catch (error) {
    console.warn('⚠️ R2 Verbindungstest Fehler:', error.message);
  }

  // Standard-Admin-Accounts erstellen (mit gehashten Passwörtern)
  await createDefaultUsers();

  // After db is initialized and before other routes:
  setFilesDbAndService(db, fileService);
  app.use('/', filesRouter);

  // Erstellen der Indizes
  db.run('CREATE INDEX IF NOT EXISTS idx_files_userId ON files(userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_files_contentHash ON files(contentHash)');
}

// Standard-Benutzer erstellen
async function createDefaultUsers() {
  const defaultUsers = [
    { username: 'admin1', password: 'admin123', role: 'admin', email: 'admin1@example.com' },
    { username: 'admin2', password: 'admin456', role: 'admin', email: 'admin2@example.com' },
    { username: 'admin3', password: 'admin789', role: 'admin', email: 'admin3@example.com' }
  ];

  for (const user of defaultUsers) {
    try {
      // Prüfe ob Benutzer bereits existiert
      const exists = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM users WHERE username = ?', [user.username], (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });

      if (!exists) {
        // Passwort hashen
        const hashedPassword = await passwordService.hashPassword(user.password);
        
        // Benutzer erstellen
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
            [user.username, hashedPassword, user.role, user.email],
            (err) => {
              if (err) reject(err);
              else {
                console.log(`✅ Admin-Benutzer ${user.username} erstellt`);
                resolve();
              }
            }
          );
        });
      }
    } catch (error) {
      console.error(`❌ Fehler beim Erstellen des Benutzers ${user.username}:`, error);
    }
  }
}

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Zu viele Anmeldeversuche, bitte versuchen Sie es später erneut.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== ROUTEN ====================

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Add a root endpoint for health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AI File Manager backend running' });
});

// Datei-Upload (geschützt mit Auth)
app.post('/upload', 
  authMiddleware,
  upload.array('files'),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
    }

    console.log(`📤 ${req.files.length} Dateien hochgeladen von Benutzer ${req.user.username}`);

    const results = [];
    const errors = [];

    // Verarbeite jede Datei
    for (const file of req.files) {
      try {
        const result = await fileService.processUploadedFile(file, req.user.id);
        results.push(result);
      } catch (error) {
        console.error(`❌ Fehler bei Datei ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // Antwort senden
    if (errors.length === 0) {
      res.json({
        success: true,
        message: `${results.length} Dateien erfolgreich hochgeladen`,
        files: results
      });
    } else if (results.length > 0) {
      res.status(207).json({
        partial: true,
        message: `${results.length} von ${req.files.length} Dateien hochgeladen`,
        files: results,
        errors: errors
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Keine Dateien konnten hochgeladen werden',
        errors: errors
      });
    }
  })
);

// Add /api/upload as an alias for /upload
app.post('/api/upload', 
  authMiddleware,
  upload.array('files'),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
    }

    console.log(`📤 ${req.files.length} Dateien hochgeladen von Benutzer ${req.user.username}`);

    const results = [];
    const errors = [];

    // Verarbeite jede Datei
    for (const file of req.files) {
      try {
        const result = await fileService.processUploadedFile(file, req.user.id);
        results.push(result);
      } catch (error) {
        console.error(`❌ Fehler bei Datei ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // Antwort senden
    if (errors.length === 0) {
      res.json({
        success: true,
        message: `${results.length} Dateien erfolgreich hochgeladen`,
        files: results
      });
    } else if (results.length > 0) {
      res.status(207).json({
        partial: true,
        message: `${results.length} von ${req.files.length} Dateien hochgeladen`,
        files: results,
        errors: errors
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Keine Dateien konnten hochgeladen werden',
        errors: errors
      });
    }
  })
);

// Dateien abrufen (geschützt mit Auth)
app.get('/files', 
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { search, tags, type, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;

    const files = await fileService.searchFiles({
      query: search,
      tags: tags ? tags.split(',') : null,
      userId: req.user.id,
      type: type,
      dateFrom: dateFrom,
      dateTo: dateTo,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: files,
      totalResults: files.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  })
);

// AI-Suche (geschützt mit Auth)
app.post('/ai-search',
  authMiddleware,
  validationRules.search,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { query } = req.body;

    const files = await fileService.searchFiles({
      query: query,
      userId: req.user.id,
      limit: 20
    });

    // AI-ähnliche Antwort generieren
    let aiResponse = '';
    if (files.length === 0) {
      aiResponse = `Ich konnte keine Dateien finden, die "${query}" entsprechen. Versuchen Sie es mit anderen Suchbegriffen.`;
    } else if (files.length === 1) {
      aiResponse = `Ich habe 1 Datei gefunden: ${files[0].originalName || files[0].name}`;
    } else {
      const fileNames = files.slice(0, 3).map(f => f.originalName || f.name).join(', ');
      aiResponse = `Ich habe ${files.length} Dateien gefunden, darunter: ${fileNames}`;
    }

    res.json({
      success: true,
      aiResponse: aiResponse,
      data: files,
      totalResults: files.length,
      searchQuery: query
    });
  })
);

// Alias für AI-Suche
app.post('/search', (req, res, next) => {
  req.url = '/ai-search';
  next();
});

// Datei herunterladen (geschützt mit Auth)
app.get('/download/:filename',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const filename = req.params.filename;

    // Datei-Info aus Datenbank abrufen
    const file = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM files WHERE name = ? AND userId = ?',
        [filename, req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    // Original-Dateinamen extrahieren
    const originalName = file.originalName || filename;

    if (file.storageType === 'r2' && file.r2ObjectKey) {
      // R2 Download
      console.log(`📥 Generiere R2 Download-URL für: ${filename}`);
      const downloadUrl = await getDownloadUrl(file.r2ObjectKey, 3600);
      res.redirect(downloadUrl);
    } else {
      // Lokaler Download
      const filePath = file.path || path.join(__dirname, 'permanent_storage', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Lokale Datei nicht gefunden' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      res.sendFile(path.resolve(filePath));
    }
  })
);

// Datei löschen (geschützt mit Auth)
app.delete('/files/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const fileId = parseInt(req.params.id);
    
    const result = await fileService.deleteFile(fileId, req.user.id);
    
    if (result.deleted) {
      res.json({
        success: true,
        message: 'Datei erfolgreich gelöscht'
      });
    } else {
      res.status(404).json({
        error: 'Datei nicht gefunden'
      });
    }
  })
);

// Benutzerstatistiken (geschützt mit Auth)
app.get('/user/stats',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const stats = await fileService.getUserStatistics(req.user.id);
    
    res.json({
      success: true,
      stats: stats
    });
  })
);

// Duplikate finden (geschützt mit Auth)
app.get('/duplicates',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const query = `
      SELECT
        duplicateGroup,
        COUNT(*) as count,
        GROUP_CONCAT(name) as fileNames,
        GROUP_CONCAT(id) as fileIds,
        GROUP_CONCAT(originalName) as originalNames
      FROM files
      WHERE duplicateGroup IS NOT NULL AND userId = ?
      GROUP BY duplicateGroup
      HAVING count > 1
      ORDER BY count DESC
    `;
    
    const duplicates = await new Promise((resolve, reject) => {
      db.all(query, [req.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      success: true,
      data: duplicates,
      totalGroups: duplicates.length
    });
  })
);

// Ähnliche Dateien finden (geschützt mit Auth)
app.post('/find-similar',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { fileId } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'Datei-ID ist erforderlich' });
    }
    
    // Datei abrufen
    const file = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM files WHERE id = ? AND userId = ?',
        [fileId, req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    const tags = JSON.parse(file.tags || '[]');
    
    if (tags.length === 0) {
      return res.json({
        success: true,
        data: [],
        totalResults: 0
      });
    }
    
    // Ähnliche Dateien suchen
    const similarFiles = await fileService.searchFiles({
      tags: tags.slice(0, 5),
      userId: req.user.id,
      type: file.type,
      limit: 20
    });
    
    // Aktuelle Datei ausschließen und nach Ähnlichkeit sortieren
    const filteredFiles = similarFiles
      .filter(f => f.id !== fileId)
      .map(f => {
        const fileTags = f.tags || [];
        const commonTags = tags.filter(tag => fileTags.includes(tag));
        const similarity = (commonTags.length / Math.max(tags.length, fileTags.length)) * 100;
        
        return {
          ...f,
          similarity: Math.round(similarity),
          commonTags: commonTags
        };
      })
      .filter(f => f.similarity >= 30)
      .sort((a, b) => b.similarity - a.similarity);
    
    res.json({
      success: true,
      data: filteredFiles,
      totalResults: filteredFiles.length,
      originalTags: tags
    });
  })
);

// Admin-Routen
app.get('/admin/users',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const users = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, username, email, role, lastLogin, createdAt FROM users',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    res.json({
      success: true,
      data: users
    });
  })
);

// Statische Dateien (für lokale Vorschau)
app.use('/preview', authMiddleware, (req, res, next) => {
  // Sicherheitsprüfung für Dateizugriff
  const requestedFile = req.path;
  const userId = req.user.id;
  
  // Prüfe ob Benutzer Zugriff auf die Datei hat
  db.get(
    'SELECT * FROM files WHERE name = ? AND userId = ?',
    [path.basename(requestedFile), userId],
    (err, file) => {
      if (err || !file) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }
      next();
    }
  );
}, express.static(path.join(__dirname, 'permanent_storage')));

// Upload-Stream (geschützt mit Auth)
app.post('/upload-stream', authMiddleware, (req, res) => {
  const busboy = new Busboy({ headers: req.headers });
  const uploads = [];
  let hasFile = false;

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    hasFile = true;
    const saveTo = path.join('uploads', Date.now() + '-' + filename.replace(/[^a-zA-Z0-9.-]/g, '_'));
    const writeStream = fs.createWriteStream(saveTo);
    file.pipe(writeStream);
    uploads.push(new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve({ filename: saveTo }));
      writeStream.on('error', reject);
    }));
  });

  busboy.on('finish', async () => {
    if (!hasFile) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    try {
      const results = await Promise.all(uploads);
      res.json({ success: true, files: results });
    } catch (err) {
      res.status(500).json({ error: 'Fehler beim Speichern der Datei', details: err.message });
    }
  });

  req.pipe(busboy);
});

// Global Chat Endpoints
app.get('/chat/global', authMiddleware, asyncHandler(async (req, res) => {
  db.all('SELECT * FROM global_chat ORDER BY timestamp ASC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Fehler beim Laden der Nachrichten' });
    res.json({ messages: rows });
  });
}));

app.post('/chat/global', authMiddleware, asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Nachricht erforderlich' });
  db.run('INSERT INTO global_chat (userId, username, message) VALUES (?, ?, ?)', [req.user.id, req.user.username, message], function(err) {
    if (err) return res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
    res.json({ success: true, id: this.lastID });
  });
}));

// Private Chat Endpoints
app.get('/chat/private/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const otherId = parseInt(req.params.userId);
  db.all(
    `SELECT * FROM private_chat WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY timestamp ASC LIMIT 100`,
    [req.user.id, otherId, otherId, req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Fehler beim Laden der Nachrichten' });
      res.json({ messages: rows });
    }
  );
}));

app.post('/chat/private/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const otherId = parseInt(req.params.userId);
  const { message } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Nachricht erforderlich' });
  db.run('INSERT INTO private_chat (senderId, receiverId, message) VALUES (?, ?, ?)', [req.user.id, otherId, message], function(err) {
    if (err) return res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
    res.json({ success: true, id: this.lastID });
  });
}));

// Fehlerbehandlung
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  let redisClient = null;
  if (redis && process.env.REDIS_URL) {
    try {
      redisClient = redis.createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) => console.warn('Redis Client Error:', err));
      await redisClient.connect();
      console.log('✅ Redis verbunden');
    } catch (error) {
      console.warn('⚠️ Redis Verbindung fehlgeschlagen - fortfahren ohne Redis');
      redisClient = null;
    }
  } else {
    console.log('Redis not configured (REDIS_URL not set). Continuing without Redis.');
  }

  const fileService = new FileService(db, redisClient);

  // Middleware Setup
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sanitizeMiddleware);
  app.use(requestLogger);

  // ... (move all route and middleware setup here, using fileService as needed) ...

  // Start server
  const server = app.listen(port, () => {
    console.log(`\n🚀 Backend-Server läuft auf http://localhost:${port}`);
    console.log(`📁 Umgebung: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Konfiguriert' : 'Standard (unsicher!)'}`);
    console.log(`☁️  R2 Storage: ${process.env.R2_ACCOUNT_ID ? 'Konfiguriert' : 'Nicht konfiguriert'}\n`);
  });

  // ... (rest of shutdown and error handling code) ...
}

startServer();

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Server wird heruntergefahren...');
  
  server.close(() => {
    console.log('✅ HTTP Server geschlossen');
    
    db.close((err) => {
      if (err) {
        console.error('❌ Fehler beim Schließen der Datenbank:', err);
      } else {
        console.log('✅ Datenbankverbindung geschlossen');
      }
      process.exit(0);
    });
  });
  
  // Erzwinge Shutdown nach 10 Sekunden
  setTimeout(() => {
    console.error('❌ Erzwungenes Herunterfahren...');
    process.exit(1);
  }, 10000);
});

// Unbehandelte Fehler abfangen
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unbehandelte Promise-Ablehnung:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Unbehandelter Fehler:', error);
  process.exit(1);
});

module.exports = { app, redisClient };
