// Vercel Serverless Function für Login
const { authenticateUser } = require('../backend/database');

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich' });
    }

    const user = await authenticateUser(username, password);

    if (user) {
      res.status(200).json({
        success: true,
        message: 'Anmeldung erfolgreich',
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Ungültige Anmeldedaten'
      });
    }
  } catch (error) {
    console.error('Fehler beim Login:', error);
    res.status(500).json({ error: 'Interner Server-Fehler beim Login' });
  }
}