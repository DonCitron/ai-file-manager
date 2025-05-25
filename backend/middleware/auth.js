const jwt = require('jsonwebtoken');

// JWT Secret - sollte in .env gespeichert werden
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

/**
 * Middleware zur Überprüfung von JWT-Tokens
 */
const authMiddleware = (req, res, next) => {
  try {
    // Token aus Header extrahieren
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Keine Authentifizierung vorhanden',
        message: 'Bitte melden Sie sich an'
      });
    }

    // Bearer Token Format überprüfen
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        error: 'Ungültiges Token Format',
        message: 'Verwenden Sie Bearer Token Format'
      });
    }

    const token = parts[1];

    // Token verifizieren
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Benutzerinformationen zur Request hinzufügen
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token abgelaufen',
        message: 'Bitte melden Sie sich erneut an'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Ungültiges Token',
        message: 'Authentifizierung fehlgeschlagen'
      });
    }
    
    return res.status(500).json({ 
      error: 'Authentifizierungsfehler',
      message: 'Ein Fehler ist aufgetreten'
    });
  }
};

/**
 * Middleware zur Überprüfung von Admin-Rechten
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Nicht authentifiziert',
      message: 'Bitte melden Sie sich an'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Keine Berechtigung',
      message: 'Admin-Rechte erforderlich'
    });
  }

  next();
};

/**
 * Token generieren
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  generateToken,
  JWT_SECRET
};
