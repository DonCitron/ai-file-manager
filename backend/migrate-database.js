const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Datenbankpfad
const dbPath = path.resolve(__dirname, 'database.db');

// Verbindung zur Datenbank herstellen
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Fehler beim Verbinden mit der Datenbank:', err.message);
    process.exit(1);
  }
  console.log('Erfolgreich mit der SQLite-Datenbank verbunden für Migration.');
});

// Migration durchführen
async function migrateDatabase() {
  console.log('🔄 Starte Datenbank-Migration...');
  
  try {
    // Prüfen ob neue Spalten bereits existieren
    await new Promise((resolve, reject) => {
      db.get("PRAGMA table_info(files)", (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    // Neue Spalten hinzufügen
    const migrations = [
      "ALTER TABLE files ADD COLUMN r2ObjectKey TEXT",
      "ALTER TABLE files ADD COLUMN storageType TEXT DEFAULT 'local'"
    ];

    for (const migration of migrations) {
      try {
        await new Promise((resolve, reject) => {
          db.run(migration, (err) => {
            if (err) {
              if (err.message.includes('duplicate column name')) {
                console.log(`⚠️ Spalte bereits vorhanden: ${migration}`);
                resolve();
              } else {
                reject(err);
              }
            } else {
              console.log(`✅ Migration erfolgreich: ${migration}`);
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`❌ Migration fehlgeschlagen: ${migration}`, error.message);
      }
    }

    // Bestehende Dateien auf 'local' setzen
    await new Promise((resolve, reject) => {
      db.run("UPDATE files SET storageType = 'local' WHERE storageType IS NULL", (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Bestehende Dateien als "local" markiert');
          resolve();
        }
      });
    });

    console.log('🎉 Datenbank-Migration erfolgreich abgeschlossen!');
    
  } catch (error) {
    console.error('❌ Fehler bei der Migration:', error.message);
  } finally {
    // Datenbankverbindung schließen
    db.close((err) => {
      if (err) {
        console.error('Fehler beim Schließen der Datenbank:', err.message);
      } else {
        console.log('Datenbankverbindung geschlossen.');
      }
      process.exit(0);
    });
  }
}

// Migration starten
migrateDatabase();