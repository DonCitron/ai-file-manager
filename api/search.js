// Vercel Serverless Function für AI-Suche
const { getAllFiles } = require('../backend/database');

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
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Suchanfrage ist erforderlich' });
    }

    console.log(`AI-Suche für: ${query}`);

    // Alle Dateien abrufen
    const allFiles = await getAllFiles();
    
    // Einfache Suche basierend auf Dateiname, Tags und Beschreibung
    const searchResults = allFiles.filter(file => {
      const searchTerm = query.toLowerCase();
      
      // Suche in Dateiname
      if (file.name.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Suche in Tags
      if (file.tags) {
        const tags = typeof file.tags === 'string' ? JSON.parse(file.tags) : file.tags;
        if (tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
          return true;
        }
      }
      
      // Suche in Beschreibung
      if (file.description && file.description.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Suche in AI-Analyse
      if (file.aiAnalysis && file.aiAnalysis.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // Spezielle Suchbegriffe
      if (searchTerm.includes('pdf') && file.type === 'application/pdf') {
        return true;
      }
      
      if (searchTerm.includes('bild') || searchTerm.includes('image')) {
        return file.type.startsWith('image/');
      }
      
      if (searchTerm.includes('dokument') || searchTerm.includes('document')) {
        return file.type.includes('document') || file.type.includes('pdf') || file.type.includes('text');
      }
      
      if (searchTerm.includes('groß') || searchTerm.includes('large')) {
        return file.size > 1024 * 1024; // Größer als 1MB
      }
      
      if (searchTerm.includes('neu') || searchTerm.includes('recent') || searchTerm.includes('letzte')) {
        const fileDate = new Date(file.uploadDate);
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return fileDate > dayAgo;
      }
      
      return false;
    });

    // Parse tags für Ergebnisse
    const processedResults = searchResults.map(file => ({
      ...file,
      tags: file.tags ? (typeof file.tags === 'string' ? JSON.parse(file.tags) : file.tags) : []
    }));

    // AI-Antwort generieren
    let aiResponse = '';
    if (processedResults.length === 0) {
      aiResponse = `Keine Dateien gefunden für "${query}". Versuchen Sie andere Suchbegriffe.`;
    } else if (processedResults.length === 1) {
      aiResponse = `1 Datei gefunden für "${query}": ${processedResults[0].name}`;
    } else {
      aiResponse = `${processedResults.length} Dateien gefunden für "${query}"`;
    }

    res.status(200).json({
      message: 'success',
      query: query,
      results: processedResults,
      aiResponse: aiResponse,
      count: processedResults.length
    });

  } catch (error) {
    console.error('Fehler bei der AI-Suche:', error);
    res.status(500).json({ error: 'Interner Server-Fehler bei der Suche' });
  }
}