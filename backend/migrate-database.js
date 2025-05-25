// migrate-database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const passwordService = require('./services/passwordService');

// Datenbankpfad
const dbPath = path.resolve(__dirname, 'database.db');

// Verbindung zur Datenbank herstellen
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Fehler beim Verbinden mit der Datenbank:', err.message);
    process.exit(1);
  }
  console.log('✅ Mit der Datenbank verbunden');
});

// Migrations-Funktionen
const migrations = [
  // Migration 1: Füge userId zu files Tabelle hinzu
  {
    name: 'add_userId_to_files',
    up: async () => {
      return new Promise((resolve, reject) => {
        // Prüfe ob Spalte bereits existiert
        db.all("PRAGMA table_info(files)", (err, columns) => {
          if (err) return reject(err);
          
          const hasUserId = columns.some(col => col.name === 'userId');
          
          if (!hasUserId) {
            db.run('ALTER TABLE files ADD COLUMN userId INTEGER', (err) => {
              if (err) reject(err);
              else {
                console.log('✅ userId Spalte zu files hinzugefügt');
                resolve();
              }
            });
          } else {
            console.log('ℹ️ userId Spalte existiert bereits');
            resolve();
          }
        });
      });
    }
  },

  // Migration 2: Füge originalName zu files Tabelle hinzu
  {
    name: 'add_originalName_to_files',
    up: async () => {
      return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(files)", (err, columns) => {
          if (err) return reject(err);
          
          const hasOriginalName = columns.some(col => col.name === 'originalName');
          
          if (!hasOriginalName) {
            db.run('ALTER TABLE files ADD COLUMN originalName TEXT', (err) => {
              if (err) reject(err);
              else {
                console.log('✅ originalName Spalte zu files hinzugefügt');
                // Kopiere existierende Namen
                db.run('UPDATE files SET originalName = name WHERE originalName IS NULL', (updateErr) => {
                  if (updateErr) console.error('Fehler beim Aktualisieren der originalName:', updateErr);
                  resolve();
                });
              }
            });
          } else {
            console.log('ℹ️ originalName Spalte existiert bereits');
            resolve();
          }
        });
      });
    }
  },

  // Migration 3: Erstelle Index für bessere Performance
  {
    name: 'create_indexes',
    up: async () => {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_files_userId ON files(userId)',
        'CREATE INDEX IF NOT EXISTS idx_files_uploadDate ON files(uploadDate)',
        'CREATE INDEX IF NOT EXISTS idx_files_contentHash ON files(contentHash)',
        'CREATE INDEX IF NOT EXISTS idx_files_type ON files(type)',
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)'
      ];

      for (const indexSql of indexes) {
        await new Promise((resolve, reject) => {
          db.run(indexSql, (err) => {
            if (err) reject(err);
            else {
              console.log(`✅ Index erstellt: ${indexSql.match(/idx_\w+/)[0]}`);
              resolve();
            }
          });
        });
      }
    }
  },

  // Migration 4: Füge email zu users Tabelle hinzu
  {
    name: 'add_email_to_users',
    up: async () => {
      return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(users)", (err, columns) => {
          if (err) return reject(err);
          
          const hasEmail = columns.some(col => col.name === 'email');
          
          if (!hasEmail) {
            db.run('ALTER TABLE users ADD COLUMN email TEXT', (err) => {
              if (err) reject(err);
              else {
                console.log('✅ email Spalte zu users hinzugefügt');
                resolve();
              }
            });
          } else {
            console.log('ℹ️ email Spalte existiert bereits');
            resolve();
          }
        });
      });
    }
  },

  // Migration 5: Füge lastLogin zu users Tabelle hinzu
  {
    name: 'add_lastLogin_to_users',
    up: async () => {
      return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(users)", (err, columns) => {
          if (err) return reject(err);
          
          const hasLastLogin = columns.some(col => col.name === 'lastLogin');
          
          if (!hasLastLogin) {
            db.run('ALTER TABLE users ADD COLUMN lastLogin TEXT', (err) => {
              if (err) reject(err);
              else {
                console.log('✅ lastLogin Spalte zu users hinzugefügt');
                resolve();
              }
            });
          } else {
            console.log('ℹ️ lastLogin Spalte existiert bereits');
            resolve();
          }
        });
      });
    }
  },

  // Migration 6: Erstelle migrations Tabelle
  {
    name: 'create_migrations_table',
    up: async () => {
      return new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            executedAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else {
            console.log('✅ migrations Tabelle erstellt');
            resolve();
          }
        });
      });
    }
  },

  // Migration 7: Passwörter hashen
  {
    name: 'hash_passwords',
    up: async () => {
      console.log('🔐 Starte Passwort-Hashing Migration...');
      try {
        const migratedCount = await passwordService.migratePasswords(db);
        console.log(`✅ ${migratedCount} Passwörter erfolgreich gehasht`);
      } catch (error) {
        console.error('❌ Fehler beim Hashen der Passwörter:', error);
        throw error;
      }
    }
  }
];

// Führe Migrationen aus
async function runMigrations() {
  console.log('🚀 Starte Datenbank-Migrationen...\n');

  // Stelle sicher, dass die migrations Tabelle existiert
  await migrations.find(m => m.name === 'create_migrations_table').up();

  for (const migration of migrations) {
    try {
      // Prüfe ob Migration bereits ausgeführt wurde
      const alreadyExecuted = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM migrations WHERE name = ?', [migration.name], (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });

      if (alreadyExecuted) {
        console.log(`⏭️  Migration "${migration.name}" bereits ausgeführt`);
        continue;
      }

      // Führe Migration aus
      console.log(`▶️  Führe Migration "${migration.name}" aus...`);
      await migration.up();

      // Markiere Migration als ausgeführt
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO migrations (name) VALUES (?)',
          [migration.name],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log(`✅ Migration "${migration.name}" erfolgreich ausgeführt\n`);
    } catch (error) {
      console.error(`❌ Fehler bei Migration "${migration.name}":`, error);
      process.exit(1);
    }
  }

  console.log('✨ Alle Migrationen erfolgreich ausgeführt!\n');
}

// Führe Migrationen aus und schließe Datenbankverbindung
runMigrations()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('❌ Fehler beim Schließen der Datenbank:', err);
      } else {
        console.log('✅ Datenbankverbindung geschlossen');
      }
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('❌ Schwerwiegender Fehler:', error);
    process.exit(1);
  });
