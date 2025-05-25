/**
 * Zentrale Fehlerbehandlung für die Anwendung
 */

// Entwicklungs-Fehlerbehandlung mit vollständigen Stack-Traces
const developmentErrors = (err, req, res, next) => {
  err.stack = err.stack || '';
  const errorDetails = {
    error: err.message,
    status: err.status || 500,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  console.error('Entwicklungs-Fehler:', errorDetails);

  res.status(err.status || 500).json({
    error: err.message,
    status: err.status || 500,
    stack: err.stack
  });
};

// Produktions-Fehlerbehandlung ohne sensible Informationen
const productionErrors = (err, req, res, next) => {
  const errorDetails = {
    error: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  console.error('Produktions-Fehler:', errorDetails);

  // Sensible Fehlermeldungen in der Produktion verbergen
  const isOperational = err.isOperational || false;
  
  res.status(err.status || 500).json({
    error: isOperational ? err.message : 'Ein Fehler ist aufgetreten',
    status: err.status || 500,
    message: 'Bitte versuchen Sie es später erneut'
  });
};

// Hauptfehlerbehandlung
const errorHandler = (err, req, res, next) => {
  // Setze Standardwerte
  err.status = err.status || 500;
  err.message = err.message || 'Interner Serverfehler';

  // Spezielle Fehlerbehandlung
  if (err.name === 'ValidationError') {
    err.status = 400;
    err.message = 'Ungültige Eingabedaten';
  } else if (err.name === 'CastError') {
    err.status = 400;
    err.message = 'Ungültiges Datenformat';
  } else if (err.code === 'ENOENT') {
    err.status = 404;
    err.message = 'Datei nicht gefunden';
  } else if (err.code === 'SQLITE_CONSTRAINT') {
    err.status = 409;
    err.message = 'Datenbankeinschränkung verletzt';
  } else if (err.code === 'SQLITE_ERROR') {
    err.status = 500;
    err.message = 'Datenbankfehler';
  }

  // Wähle Fehlerbehandlung basierend auf Umgebung
  if (process.env.NODE_ENV === 'development') {
    developmentErrors(err, req, res, next);
  } else {
    productionErrors(err, req, res, next);
  }
};

// 404 Fehlerbehandlung
const notFoundHandler = (req, res, next) => {
  const err = new Error('Ressource nicht gefunden');
  err.status = 404;
  next(err);
};

// Async Error Handler Wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom Error Klasse
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Logging Middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  requestLogger
};
