// Umgebungsvariablen laden
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose(); // SQLite importieren
const fs = require('fs'); // File System Modul importieren
const { analyzeFileWithGemini, detectSimilarFiles, generateDuplicateGroupId } = require('./geminiService'); // Gemini AI-Service importieren
const { uploadToR2, getDownloadUrl, testR2Connection } = require('./r2Service'); // Cloudflare R2 Service importieren

const app = express();
const port = 3000; // Oder ein anderer Port

// SQLite Datenbank initialisieren
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Fehler beim Verbinden mit der SQLite-Datenbank:', err.message);
  } else {
    console.log('Erfolgreich mit der SQLite-Datenbank verbunden.');
    // Tabelle erstellen, falls sie nicht existiert
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
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
      storageType TEXT DEFAULT 'local'
    )`, (err) => {
      if (err) {
        console.error('Fehler beim Erstellen der Tabelle "files":', err.message);
      } else {
        console.log('Tabelle "files" erfolgreich erstellt oder bereits vorhanden.');
      }
    });

    // Users Tabelle erstellen
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Fehler beim Erstellen der Tabelle "users":', err.message);
      } else {
        console.log('Tabelle "users" erfolgreich erstellt oder bereits vorhanden.');
        
        // Standard-Admin-Accounts erstellen
        const defaultUsers = [
          { username: 'admin1', password: 'admin123', role: 'admin' },
          { username: 'admin2', password: 'admin456', role: 'admin' },
          { username: 'admin3', password: 'admin789', role: 'admin' }
        ];

        defaultUsers.forEach(user => {
          db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
            [user.username, user.password, user.role],
            function(err) {
              if (err) {
                console.error(`Fehler beim Erstellen des Benutzers ${user.username}:`, err.message);
              } else if (this.changes > 0) {
                console.log(`Admin-Benutzer ${user.username} erfolgreich erstellt.`);
              }
            }
          );
        });
      }
    });
    
    // R2 Verbindung testen beim Start
    (async () => {
      try {
        const r2Connected = await testR2Connection();
        if (r2Connected) {
          console.log('✅ Cloudflare R2 connection successful');
        } else {
          console.warn('⚠️ Cloudflare R2 connection failed - falling back to local storage');
        }
      } catch (error) {
        console.warn('⚠️ R2 connection test error:', error.message);
      }
    })();
  }
});

// CORS für Cross-Origin-Anfragen vom Frontend
app.use(cors());

// Middleware zum Parsen von JSON-Anfragen
app.use(express.json());

// Multer-Konfiguration für Dateiuploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Temporäres Verzeichnis für Uploads
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    // Dateiname beibehalten
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Endpunkt für Dateiupload
app.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('Keine Dateien hochgeladen.');
  }

  console.log('Dateien erfolgreich hochgeladen:', req.files);

  // Simulierte AI-Verarbeitung und Speicherung
  let errorOccurred = false; // Flag, um zu verfolgen, ob ein Fehler gesendet wurde

  const fileProcessingPromises = req.files.map(file => {
    return new Promise(async (resolve, reject) => {
      console.log(`Verarbeite Datei mit erweiterter AI-Analyse: ${file.originalname}`);
      
      // Erweiterte AI-Verarbeitung mit Google Gemini
      let analysisResult;
      try {
        analysisResult = await analyzeFileWithGemini(file, file.path);
        console.log(`Erweiterte Gemini AI-Analyse für ${file.originalname}:`, analysisResult);
      } catch (aiError) {
        console.error(`Gemini AI-Analyse fehlgeschlagen für ${file.originalname}:`, aiError.message);
        // Fallback zur simulierten Verarbeitung
        const fallbackTags = simulateAIProcessing(file);
        analysisResult = {
          tags: fallbackTags,
          description: `${file.originalname} - Automatisch hochgeladen`,
          aiAnalysis: 'Fallback-Analyse verwendet',
          contentHash: 'unknown'
        };
        console.log(`Fallback-Analyse für ${file.originalname}:`, analysisResult);
      }

      // Duplikatserkennung durchführen
      let duplicateInfo;
      try {
        duplicateInfo = await detectSimilarFiles(file, analysisResult, db);
        console.log(`Duplikatserkennung für ${file.originalname}:`, duplicateInfo);
      } catch (dupError) {
        console.error(`Duplikatserkennung fehlgeschlagen für ${file.originalname}:`, dupError.message);
        duplicateInfo = { type: 'unknown', duplicates: [], confidence: 0 };
      }

    const uploadDate = new Date().toISOString();
    const tagsString = JSON.stringify(analysisResult.tags); // Tags als JSON-String speichern
    const duplicateGroup = duplicateInfo.type === 'exact' ? generateDuplicateGroupId() : null;
    const tempPath = file.path;
    const uniqueFilename = `${Date.now()}-${file.originalname}`;

    // Versuche Upload zu Cloudflare R2
    let r2ObjectKey = null;
    let finalPath = null;
    let storageType = 'local';

    try {
      // R2 Upload versuchen
      r2ObjectKey = await uploadToR2(tempPath, file.originalname, file.mimetype);
      finalPath = r2ObjectKey; // R2 Object Key als Pfad speichern
      storageType = 'r2';
      console.log(`✅ Datei ${file.originalname} erfolgreich zu R2 hochgeladen: ${r2ObjectKey}`);
    } catch (r2Error) {
      console.warn(`⚠️ R2 Upload fehlgeschlagen für ${file.originalname}, verwende lokalen Speicher:`, r2Error.message);
      
      // Fallback zu lokalem Speicher
      const permanentStorageDir = path.resolve(__dirname, 'permanent_storage');
      const permanentPath = path.join(permanentStorageDir, uniqueFilename);
      
      // Sicherstellen, dass das Zielverzeichnis existiert
      if (!fs.existsSync(permanentStorageDir)){
          fs.mkdirSync(permanentStorageDir, { recursive: true });
      }

      try {
        // Datei lokal verschieben
        fs.renameSync(tempPath, permanentPath);
        finalPath = permanentPath;
        storageType = 'local';
        console.log(`📁 Datei ${file.originalname} erfolgreich lokal gespeichert: ${permanentPath}`);
      } catch (localError) {
        console.error(`❌ Lokaler Speicher fehlgeschlagen für ${file.originalname}:`, localError);
        if (!errorOccurred && !res.headersSent) {
          res.status(500).send(`Fehler beim Verarbeiten der Datei ${file.originalname}: Speicherung fehlgeschlagen.`);
          errorOccurred = true;
        }
        return reject(localError);
      }
    }

    // Erweiterte Dateiinformationen in die SQLite-Datenbank einfügen
    db.run(`INSERT INTO files (name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uniqueFilename, file.mimetype, file.size, finalPath, r2ObjectKey, tagsString, uploadDate, analysisResult.description, analysisResult.aiAnalysis, analysisResult.contentHash, duplicateGroup, storageType],
        function(dbErr) { // Benenne err zu dbErr um, um Konflikte zu vermeiden
          if (dbErr) {
            console.error('Fehler beim Einfügen der Dateiinformationen in die Datenbank:', dbErr.message);
            if (!errorOccurred && !res.headersSent) {
              res.status(500).send(`Fehler beim Speichern der Dateiinformationen für ${file.originalname}.`);
              errorOccurred = true;
            }
            return reject(dbErr);
          }
          console.log(`Datei ${file.originalname} (ID: ${this.lastID}) erfolgreich in Datenbank eingefügt.`);
          resolve();
        }
      );
    });
  });

  Promise.all(fileProcessingPromises)
    .then(() => {
      if (!errorOccurred && !res.headersSent) {
        res.send('Alle Dateien erfolgreich hochgeladen und verarbeitet.');
      }
    })
    .catch(err => {
      // Fehler wurden bereits innerhalb der Promises behandelt und gesendet,
      // aber wir loggen hier ggf. nochmals, falls ein unerwarteter Fehler auftritt.
      if (!errorOccurred && !res.headersSent) {
        console.error("Ein Fehler ist beim Verarbeiten der Dateiuploads aufgetreten:", err);
        res.status(500).send("Ein Fehler ist beim Verarbeiten einiger Dateien aufgetreten.");
      }
    });
});

// Endpunkt zum Abrufen von Dateien mit optionaler Filterung/Suche
app.get('/files', (req, res) => {
  const { search, tags } = req.query;
  
  let query = "SELECT id, name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType FROM files";
  let params = [];
  let whereConditions = [];

  // Suche nach Dateinamen
  if (search && search.trim() !== '') {
    whereConditions.push("name LIKE ?");
    params.push(`%${search.trim()}%`);
  }

  // Filtern nach Tags
  if (tags && tags.trim() !== '') {
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    if (tagArray.length > 0) {
      // Für jeden Tag eine LIKE-Bedingung hinzufügen (da Tags als JSON-String gespeichert sind)
      const tagConditions = tagArray.map(() => "tags LIKE ?");
      whereConditions.push(`(${tagConditions.join(' AND ')})`);
      
      // Parameter für jeden Tag hinzufügen
      tagArray.forEach(tag => {
        params.push(`%"${tag}"%`); // JSON-String Format berücksichtigen
      });
    }
  }

  // WHERE-Klausel hinzufügen, falls Bedingungen vorhanden sind
  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(' AND ');
  }

  query += " ORDER BY uploadDate DESC";

  console.log('Ausgeführte Datenbankabfrage:', query);
  console.log('Parameter:', params);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Datenbankfehler bei /files:', err.message);
      res.status(500).json({ "error": err.message });
      return;
    }
    
    // Tags von JSON-String zurück in Array umwandeln für das Frontend
    const filesWithParsedTags = rows.map(file => ({
      ...file,
      tags: file.tags ? JSON.parse(file.tags) : []
    }));
    
    res.json({
      message: "success",
      data: filesWithParsedTags,
      totalResults: filesWithParsedTags.length
    });
  });
});

// Login-Endpunkt
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username und Password sind erforderlich' });
  }

  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
    if (err) {
      console.error('Datenbankfehler bei Login:', err.message);
      return res.status(500).json({ error: 'Server-Fehler' });
    }
    
    if (row) {
      // Erfolgreicher Login
      res.json({
        success: true,
        user: {
          id: row.id,
          username: row.username,
          role: row.role
        },
        message: 'Login erfolgreich'
      });
    } else {
      // Fehlgeschlagener Login
      res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }
  });
});

// Endpunkt zum Überprüfen der Session (optional)
app.get('/verify-session', (req, res) => {
  // In einer echten Anwendung würde hier JWT oder Session-Validierung stattfinden
  res.json({ valid: true });
});

// AI-Suchfunktion für Dateien
app.post('/ai-search', (req, res) => {
  const { query } = req.body;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Suchanfrage ist erforderlich' });
  }

  console.log('AI-Suche für:', query);

  // Erweiterte Suche in Dateinamen, Tags und Metadaten
  const searchQuery = `
    SELECT id, name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType
    FROM files
    WHERE name LIKE ?
       OR tags LIKE ?
       OR type LIKE ?
       OR description LIKE ?
    ORDER BY uploadDate DESC
  `;
  
  const searchTerm = `%${query.trim()}%`;
  const params = [searchTerm, searchTerm, searchTerm, searchTerm];

  db.all(searchQuery, params, (err, rows) => {
    if (err) {
      console.error('Datenbankfehler bei AI-Suche:', err.message);
      return res.status(500).json({ error: err.message });
    }
    
    // Tags von JSON-String zurück in Array umwandeln
    const filesWithParsedTags = rows.map(file => ({
      ...file,
      tags: file.tags ? JSON.parse(file.tags) : []
    }));
    
    // AI-ähnliche Antwort generieren
    let aiResponse = '';
    if (filesWithParsedTags.length === 0) {
      aiResponse = `Ich konnte keine Dateien finden, die "${query}" entsprechen. Versuchen Sie es mit anderen Suchbegriffen.`;
    } else if (filesWithParsedTags.length === 1) {
      aiResponse = `Ich habe 1 Datei gefunden, die "${query}" entspricht: ${filesWithParsedTags[0].name}`;
    } else {
      aiResponse = `Ich habe ${filesWithParsedTags.length} Dateien gefunden, die "${query}" entsprechen. Hier sind die Ergebnisse:`;
    }
    
    res.json({
      message: "success",
      aiResponse: aiResponse,
      data: filesWithParsedTags,
      totalResults: filesWithParsedTags.length,
      searchQuery: query
    });
  });
});

// Alias für AI-Suche (für Frontend-Kompatibilität)
app.post('/search', (req, res) => {
  const { query } = req.body;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Suchanfrage ist erforderlich' });
  }

  console.log(`AI-Suche für: ${query}`);
  
  const searchQuery = `
    SELECT id, name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType
    FROM files
    WHERE name LIKE ?
       OR tags LIKE ?
       OR type LIKE ?
       OR description LIKE ?
    ORDER BY uploadDate DESC
  `;
  
  const searchTerm = `%${query.trim()}%`;
  const params = [searchTerm, searchTerm, searchTerm, searchTerm];

  db.all(searchQuery, params, (err, rows) => {
    if (err) {
      console.error('Datenbankfehler bei AI-Suche:', err.message);
      return res.status(500).json({ error: err.message });
    }
    
    // Tags von JSON-String zurück in Array umwandeln
    const filesWithParsedTags = rows.map(file => ({
      ...file,
      tags: file.tags ? JSON.parse(file.tags) : []
    }));
    
    // AI-ähnliche Antwort generieren
    let aiResponse = '';
    if (filesWithParsedTags.length === 0) {
      aiResponse = `Ich konnte keine Dateien finden, die "${query}" entsprechen. Versuchen Sie es mit anderen Suchbegriffen.`;
    } else if (filesWithParsedTags.length === 1) {
      aiResponse = `Ich habe 1 Datei gefunden, die "${query}" entspricht: ${filesWithParsedTags[0].name}`;
    } else {
      aiResponse = `Ich habe ${filesWithParsedTags.length} Dateien gefunden, die "${query}" entsprechen. Hier sind die Ergebnisse:`;
    }
    
    res.json({
      message: "success",
      aiResponse: aiResponse,
      data: filesWithParsedTags,
      totalResults: filesWithParsedTags.length,
      searchQuery: query
    });
  });
});

// Neuer Endpunkt für Duplikatserkennung
app.get('/duplicates', (req, res) => {
  const query = `
    SELECT
      duplicateGroup,
      COUNT(*) as count,
      GROUP_CONCAT(name) as fileNames,
      GROUP_CONCAT(id) as fileIds
    FROM files
    WHERE duplicateGroup IS NOT NULL
    GROUP BY duplicateGroup
    HAVING count > 1
    ORDER BY count DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Datenbankfehler bei Duplikatserkennung:', err.message);
      return res.status(500).json({ error: err.message });
    }
    
    res.json({
      message: "success",
      data: rows,
      totalGroups: rows.length
    });
  });
});

// Endpunkt für ähnliche Dateien basierend auf Tags
app.post('/find-similar', (req, res) => {
  const { fileId } = req.body;
  
  if (!fileId) {
    return res.status(400).json({ error: 'Datei-ID ist erforderlich' });
  }
  
  // Erst die Datei-Tags abrufen
  db.get(`SELECT tags, type FROM files WHERE id = ?`, [fileId], (err, file) => {
    if (err) {
      console.error('Datenbankfehler beim Abrufen der Datei:', err.message);
      return res.status(500).json({ error: err.message });
    }
    
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    
    try {
      const tags = JSON.parse(file.tags || '[]');
      
      if (tags.length === 0) {
        return res.json({
          message: "success",
          data: [],
          totalResults: 0
        });
      }
      
      // Ähnliche Dateien finden
      const tagConditions = tags.slice(0, 5).map(() => "tags LIKE ?").join(' OR ');
      const similarQuery = `
        SELECT id, name, type, size, path, tags, uploadDate, description, aiAnalysis
        FROM files
        WHERE id != ? AND type = ? AND (${tagConditions})
        ORDER BY uploadDate DESC
        LIMIT 20
      `;
      
      const params = [fileId, file.type, ...tags.slice(0, 5).map(tag => `%"${tag}"%`)];
      
      db.all(similarQuery, params, (err, rows) => {
        if (err) {
          console.error('Datenbankfehler bei der Ähnlichkeitssuche:', err.message);
          return res.status(500).json({ error: err.message });
        }
        
        // Ähnlichkeit berechnen und filtern
        const similarFiles = rows.map(row => {
          try {
            const rowTags = JSON.parse(row.tags || '[]');
            const commonTags = tags.filter(tag => rowTags.includes(tag));
            const similarity = (commonTags.length / Math.max(tags.length, rowTags.length)) * 100;
            
            return {
              ...row,
              tags: rowTags,
              similarity: Math.round(similarity),
              commonTags: commonTags
            };
          } catch (e) {
            return null;
          }
        }).filter(file => file && file.similarity >= 30) // Mindestens 30% Ähnlichkeit
          .sort((a, b) => b.similarity - a.similarity);
        
        res.json({
          message: "success",
          data: similarFiles,
          totalResults: similarFiles.length,
          originalTags: tags
        });
      });
      
    } catch (parseError) {
      console.error('Fehler beim Parsen der Tags:', parseError.message);
      res.status(500).json({ error: 'Fehler beim Verarbeiten der Datei-Tags' });
    }
  });
});

// Simulierte AI-Verarbeitungsfunktion (bleibt vorerst gleich)
function simulateAIProcessing(file) {
  // In einer echten Anwendung würde hier die AI-Logik stehen
  // Basierend auf Dateityp oder Inhalt Tags generieren
  const tags = ['uploaded', file.mimetype.split('/')[0]]; // Beispiel: 'uploaded', 'image'
  if (file.originalname.includes('report')) {
    tags.push('report');
  }
  return tags;
}

// Die simulierte Datenbank-Speicherfunktion wird nicht mehr benötigt,
// da wir jetzt direkt mit SQLite interagieren.
// async function simulateDatabaseSave(fileInfo) { ... }


// Statische Dateien servieren
app.use('/files', express.static(path.join(__dirname, 'permanent_storage')));

// Verbesserter Download-Endpunkt mit R2-Unterstützung
app.get('/download/:filename', async (req, res) => {
  const filename = req.params.filename;
  
  try {
    // Datei-Info aus Datenbank abrufen
    db.get(`SELECT name, r2ObjectKey, storageType, path FROM files WHERE name = ?`, [filename], async (err, row) => {
      if (err) {
        console.error('Datenbankfehler beim Download:', err.message);
        return res.status(500).json({ error: 'Server-Fehler' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }
      
      // Originalen Dateinamen extrahieren (nach dem Timestamp)
      const originalName = filename.includes('-') ? filename.substring(filename.indexOf('-') + 1) : filename;
      
      try {
        if (row.storageType === 'r2' && row.r2ObjectKey) {
          // R2 Download
          console.log(`📥 Generiere R2 Download-URL für: ${filename}`);
          const downloadUrl = await getDownloadUrl(row.r2ObjectKey, 3600); // 1 Stunde gültig
          
          // Redirect zur signierten R2-URL
          res.redirect(downloadUrl);
          
        } else {
          // Lokaler Download
          const filePath = row.path || path.join(__dirname, 'permanent_storage', filename);
          
          // Überprüfen ob lokale Datei existiert
          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Lokale Datei nicht gefunden' });
          }
          
          console.log(`📁 Lokaler Download für: ${filename}`);
          
          // Content-Disposition Header setzen für korrekten Download
          res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          
          // Datei senden
          res.sendFile(path.resolve(filePath), (err) => {
            if (err) {
              console.error('Fehler beim Senden der lokalen Datei:', err);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Fehler beim Download' });
              }
            }
          });
        }
        
      } catch (downloadError) {
        console.error('Fehler beim Download-Prozess:', downloadError);
        res.status(500).json({ error: 'Fehler beim Generieren des Downloads' });
      }
    });
    
  } catch (error) {
    console.error('Allgemeiner Download-Fehler:', error);
    res.status(500).json({ error: 'Server-Fehler beim Download' });
  }
});

// Server starten
app.listen(port, () => {
  console.log(`Backend-Server läuft auf http://localhost:${port}`);
});

// Graceful Shutdown für die Datenbankverbindung
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('SQLite-Datenbankverbindung geschlossen.');
    process.exit(0);
  });
});