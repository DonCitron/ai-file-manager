const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * Service für sichere Passwort-Verwaltung
 */
class PasswordService {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
  }

  /**
   * Hasht ein Passwort mit bcrypt
   * @param {string} password - Das zu hashende Passwort
   * @returns {Promise<string>} - Der gehashte Passwort-String
   */
  async hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Ungültiges Passwort');
    }

    if (password.length < 6) {
      throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
    }

    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      return hash;
    } catch (error) {
      console.error('Fehler beim Hashen des Passworts:', error);
      throw new Error('Fehler bei der Passwort-Verarbeitung');
    }
  }

  /**
   * Überprüft ein Passwort gegen einen Hash
   * @param {string} password - Das zu überprüfende Passwort
   * @param {string} hash - Der gespeicherte Hash
   * @returns {Promise<boolean>} - True wenn Passwort korrekt
   */
  async verifyPassword(password, hash) {
    if (!password || !hash) {
      return false;
    }

    try {
      const isValid = await bcrypt.compare(password, hash);
      return isValid;
    } catch (error) {
      console.error('Fehler bei der Passwort-Überprüfung:', error);
      return false;
    }
  }

  /**
   * Generiert ein zufälliges temporäres Passwort
   * @param {number} length - Länge des Passworts (default: 12)
   * @returns {string} - Zufälliges Passwort
   */
  generateTemporaryPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Überprüft die Passwort-Stärke
   * @param {string} password - Das zu überprüfende Passwort
   * @returns {Object} - Stärke-Bewertung und Empfehlungen
   */
  checkPasswordStrength(password) {
    const result = {
      score: 0,
      strength: 'Sehr schwach',
      suggestions: []
    };

    if (!password) {
      return result;
    }

    // Länge prüfen
    if (password.length >= 8) result.score += 1;
    if (password.length >= 12) result.score += 1;
    else result.suggestions.push('Verwenden Sie mindestens 12 Zeichen');

    // Komplexität prüfen
    if (/[a-z]/.test(password)) result.score += 1;
    else result.suggestions.push('Fügen Sie Kleinbuchstaben hinzu');

    if (/[A-Z]/.test(password)) result.score += 1;
    else result.suggestions.push('Fügen Sie Großbuchstaben hinzu');

    if (/[0-9]/.test(password)) result.score += 1;
    else result.suggestions.push('Fügen Sie Zahlen hinzu');

    if (/[^a-zA-Z0-9]/.test(password)) result.score += 1;
    else result.suggestions.push('Fügen Sie Sonderzeichen hinzu');

    // Bewertung zuweisen
    if (result.score <= 2) result.strength = 'Sehr schwach';
    else if (result.score <= 3) result.strength = 'Schwach';
    else if (result.score <= 4) result.strength = 'Mittel';
    else if (result.score <= 5) result.strength = 'Stark';
    else result.strength = 'Sehr stark';

    return result;
  }

  /**
   * Migriert alte Plaintext-Passwörter zu gehashten Passwörtern
   * @param {Object} db - Datenbank-Instanz
   */
  async migratePasswords(db) {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, username, password FROM users', async (err, users) => {
        if (err) {
          return reject(err);
        }

        let migrated = 0;
        
        for (const user of users) {
          // Prüfe ob Passwort bereits gehasht ist (bcrypt hashes beginnen mit $2)
          if (!user.password.startsWith('$2')) {
            try {
              const hashedPassword = await this.hashPassword(user.password);
              
              await new Promise((resolveUpdate, rejectUpdate) => {
                db.run(
                  'UPDATE users SET password = ? WHERE id = ?',
                  [hashedPassword, user.id],
                  (updateErr) => {
                    if (updateErr) rejectUpdate(updateErr);
                    else {
                      console.log(`Passwort für Benutzer ${user.username} migriert`);
                      migrated++;
                      resolveUpdate();
                    }
                  }
                );
              });
            } catch (error) {
              console.error(`Fehler bei Migration für Benutzer ${user.username}:`, error);
            }
          }
        }

        console.log(`Passwort-Migration abgeschlossen: ${migrated} Passwörter migriert`);
        resolve(migrated);
      });
    });
  }
}

// Singleton-Instanz
const passwordService = new PasswordService();

module.exports = passwordService;
