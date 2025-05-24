const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

// Datenbank initialisieren
function initDatabase() {
  if (db) return db;

  // Für Vercel verwenden wir eine temporäre Datenbank
  const dbPath = process.env.VERCEL ? '/tmp/database.db' : path.resolve(__dirname, 'database.db');
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Fehler beim Verbinden mit der SQLite-Datenbank:', err.message);
    } else {
      console.log('Erfolgreich mit der SQLite-Datenbank verbunden.');
      
      // Tabellen erstellen
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
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
      )`);

      // Benutzer-Accounts erstellen
      const users = [
        { username: 'pascal', password: 'secure123', role: 'admin' },
        { username: 'maria', password: 'maria456', role: 'user' },
        { username: 'alex', password: 'alex789', role: 'user' }
      ];

      users.forEach(user => {
        db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
          [user.username, user.password, user.role], (err) => {
            if (!err) {
              console.log(`Benutzer ${user.username} (${user.role}) erfolgreich erstellt.`);
            }
          });
      });
    }
  });

  return db;
}

// Datei in Datenbank einfügen
function insertFile(fileData) {
  return new Promise((resolve, reject) => {
    const db = initDatabase();
    
    const query = `INSERT INTO files (name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      fileData.name,
      fileData.type,
      fileData.size,
      fileData.path,
      fileData.r2ObjectKey,
      fileData.tags,
      fileData.uploadDate,
      fileData.description,
      fileData.aiAnalysis,
      fileData.contentHash,
      fileData.duplicateGroup,
      fileData.storageType
    ];

    db.run(query, params, function(err) {
      if (err) {
        console.error('Fehler beim Einfügen der Dateiinformationen in die Datenbank:', err.message);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Alle Dateien abrufen
function getAllFiles() {
  return new Promise((resolve, reject) => {
    const db = initDatabase();
    
    const query = `SELECT id, name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType 
                   FROM files ORDER BY uploadDate DESC`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Fehler beim Abrufen der Dateien:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Benutzer authentifizieren
function authenticateUser(username, password) {
  return new Promise((resolve, reject) => {
    const db = initDatabase();
    
    const query = `SELECT id, username, role FROM users WHERE username = ? AND password = ?`;
    
    db.get(query, [username, password], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Ähnliche Dateien finden
function findSimilarFiles(filename, contentHash) {
  return new Promise((resolve, reject) => {
    const db = initDatabase();
    
    const query = `SELECT id, name, path, description, tags FROM files 
                   WHERE (name LIKE ? OR contentHash = ?) AND contentHash != ?`;
    
    db.all(query, [`%${filename}%`, contentHash, contentHash], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  initDatabase,
  insertFile,
  getAllFiles,
  authenticateUser,
  findSimilarFiles
};