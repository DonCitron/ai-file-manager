// Auth Controller
// Handles user authentication logic

const { generateToken } = require('../middleware/auth');
const passwordService = require('../services/passwordService');
const crypto = require('crypto');

// These stores should be shared with server.js or moved to a shared module in a real refactor
const failedLoginAttempts = {};
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const passwordResetTokens = {};
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

module.exports = {
  async login(req, res, db) {
    const { username, password } = req.body;
    const now = Date.now();
    if (failedLoginAttempts[username] && failedLoginAttempts[username].lockoutUntil > now) {
      return res.status(429).json({
        error: 'Account gesperrt',
        message: `Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuchen Sie es nach ${Math.ceil((failedLoginAttempts[username].lockoutUntil - now) / 60000)} Minuten erneut.`
      });
    }
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!user) {
      failedLoginAttempts[username] = failedLoginAttempts[username] || { count: 0, lockoutUntil: 0 };
      failedLoginAttempts[username].count++;
      if (failedLoginAttempts[username].count >= LOCKOUT_THRESHOLD) {
        failedLoginAttempts[username].lockoutUntil = now + LOCKOUT_DURATION;
      }
      console.log(`[AUTH] Failed login for username: ${username} from IP: ${req.ip} at ${new Date().toISOString()}`);
      return res.status(401).json({ 
        error: 'Ungültige Anmeldedaten',
        message: 'Benutzername oder Passwort falsch'
      });
    }
    const isValidPassword = await passwordService.verifyPassword(password, user.password);
    if (!isValidPassword) {
      failedLoginAttempts[username] = failedLoginAttempts[username] || { count: 0, lockoutUntil: 0 };
      failedLoginAttempts[username].count++;
      if (failedLoginAttempts[username].count >= LOCKOUT_THRESHOLD) {
        failedLoginAttempts[username].lockoutUntil = now + LOCKOUT_DURATION;
      }
      console.log(`[AUTH] Failed login for username: ${username} from IP: ${req.ip} at ${new Date().toISOString()}`);
      return res.status(401).json({ 
        error: 'Ungültige Anmeldedaten',
        message: 'Benutzername oder Passwort falsch'
      });
    }
    delete failedLoginAttempts[username];
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET lastLogin = ? WHERE id = ?',
        [new Date().toISOString(), user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    const token = generateToken(user);
    if (process.env.USE_AUTH_COOKIE === 'true') {
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
    }
    console.log(`[AUTH] Successful login for username: ${username} from IP: ${req.ip} at ${new Date().toISOString()}`);
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      message: 'Login erfolgreich'
    });
  },

  verifySession(req, res) {
    res.json({ 
      valid: true,
      user: req.user
    });
  },

  async requestPasswordReset(req, res, db) {
    const { username, email } = req.body;
    if (!username && !email) {
      return res.status(400).json({ error: 'Benutzername oder E-Mail erforderlich' });
    }
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    passwordResetTokens[token] = {
      userId: user.id,
      expires: Date.now() + PASSWORD_RESET_TOKEN_EXPIRY
    };
    console.log(`🔑 Passwort-Reset-Token für ${user.username}: ${token}`);
    res.json({ success: true, message: 'Passwort-Reset-Token generiert. (In Produktion per E-Mail versenden.)' });
  },

  async resetPassword(req, res, db) {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token und neues Passwort erforderlich' });
    }
    const entry = passwordResetTokens[token];
    if (!entry || entry.expires < Date.now()) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Token' });
    }
    const hashedPassword = await passwordService.hashPassword(newPassword);
    await new Promise((resolve, reject) => {
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, entry.userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    delete passwordResetTokens[token];
    console.log(`[AUTH] Password reset for userId: ${entry.userId} at ${new Date().toISOString()}`);
    res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });
  }
};
