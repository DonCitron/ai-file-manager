// Vercel Serverless Function für Dateien abrufen
const { getAllFiles } = require('../backend/database');

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
    console.log('Ausgeführte Datenbankabfrage: SELECT id, name, type, size, path, r2ObjectKey, tags, uploadDate, description, aiAnalysis, contentHash, duplicateGroup, storageType FROM files ORDER BY uploadDate DESC');
    console.log('Parameter: []');

    const files = await getAllFiles();
    
    // Parse tags JSON für jede Datei
    const processedFiles = files.map(file => ({
      ...file,
      tags: file.tags ? JSON.parse(file.tags) : []
    }));

    res.status(200).json(processedFiles);
  } catch (error) {
    console.error('Fehler beim Abrufen der Dateien:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Dateien' });
  }
}