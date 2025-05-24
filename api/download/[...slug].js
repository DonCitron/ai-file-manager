// Vercel Serverless Function für Downloads
const { getDownloadUrl } = require('../../backend/r2Service');
const { getAllFiles } = require('../../backend/database');
const fs = require('fs');

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { slug } = req.query;
    const filename = Array.isArray(slug) ? slug.join('/') : slug;

    if (!filename) {
      return res.status(400).json({ error: 'Dateiname ist erforderlich' });
    }

    console.log(`Download-Anfrage für: ${filename}`);

    // Datei in Datenbank finden
    const files = await getAllFiles();
    const file = files.find(f => f.name === filename || f.path.includes(filename));

    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    // Wenn Datei in R2 gespeichert ist
    if (file.storageType === 'r2' && file.r2ObjectKey) {
      try {
        console.log(`📥 R2 Download für: ${file.r2ObjectKey}`);
        const downloadUrl = await getDownloadUrl(file.r2ObjectKey);
        
        // Redirect zu signierter R2-URL
        res.redirect(302, downloadUrl);
        return;
      } catch (r2Error) {
        console.error(`Fehler beim R2-Download für ${filename}:`, r2Error);
        return res.status(500).json({ error: 'Fehler beim R2-Download' });
      }
    }

    // Fallback: Lokale Datei (für Vercel nicht ideal, aber als Backup)
    if (file.storageType === 'local' && file.path) {
      try {
        console.log(`📁 Lokaler Download für: ${file.path}`);
        
        if (fs.existsSync(file.path)) {
          const fileBuffer = fs.readFileSync(file.path);
          
          res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
          res.setHeader('Content-Type', file.type || 'application/octet-stream');
          res.setHeader('Content-Length', fileBuffer.length);
          
          res.send(fileBuffer);
          return;
        } else {
          return res.status(404).json({ error: 'Lokale Datei nicht gefunden' });
        }
      } catch (localError) {
        console.error(`Fehler beim lokalen Download für ${filename}:`, localError);
        return res.status(500).json({ error: 'Fehler beim lokalen Download' });
      }
    }

    res.status(404).json({ error: 'Datei nicht verfügbar' });

  } catch (error) {
    console.error('Fehler beim Download:', error);
    res.status(500).json({ error: 'Interner Server-Fehler beim Download' });
  }
}