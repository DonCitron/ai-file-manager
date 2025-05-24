const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Datenbank öffnen
const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Füge neue Benutzer zur Datenbank hinzu...');

// Neue Benutzer hinzufügen
const users = [
  { username: 'pascal', password: 'secure123', role: 'admin' },
  { username: 'maria', password: 'maria456', role: 'user' },
  { username: 'alex', password: 'alex789', role: 'user' }
];

users.forEach(user => {
  db.run(`INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)`, 
    [user.username, user.password, user.role], function(err) {
      if (err) {
        console.error(`❌ Fehler beim Hinzufügen von ${user.username}:`, err.message);
      } else {
        console.log(`✅ Benutzer ${user.username} (${user.role}) erfolgreich hinzugefügt.`);
      }
    });
});

// Alle Benutzer anzeigen
setTimeout(() => {
  db.all(`SELECT username, role FROM users`, [], (err, rows) => {
    if (err) {
      console.error('Fehler beim Abrufen der Benutzer:', err.message);
    } else {
      console.log('\n📋 Aktuelle Benutzer in der Datenbank:');
      rows.forEach(row => {
        console.log(`   - ${row.username} (${row.role})`);
      });
    }
    
    db.close((err) => {
      if (err) {
        console.error('Fehler beim Schließen der Datenbank:', err.message);
      } else {
        console.log('\n🎉 Migration abgeschlossen!');
      }
    });
  });
}, 1000);