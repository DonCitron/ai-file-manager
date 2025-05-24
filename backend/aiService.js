const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// OpenAI Client initialisieren
// WICHTIG: Sie müssen Ihren OpenAI API Key als Umgebungsvariable setzen
// Beispiel: export OPENAI_API_KEY="your-api-key-here"
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analysiert eine Datei mit OpenAI und generiert relevante Tags
 * @param {Object} fileInfo - Informationen über die Datei
 * @param {string} fileInfo.originalname - Originaler Dateiname
 * @param {string} fileInfo.mimetype - MIME-Type der Datei
 * @param {number} fileInfo.size - Dateigröße in Bytes
 * @param {string} filePath - Pfad zur Datei
 * @returns {Promise<string[]>} Array von generierten Tags
 */
async function analyzeFileWithAI(fileInfo, filePath) {
  try {
    console.log(`AI-Analyse gestartet für: ${fileInfo.originalname}`);
    
    const { originalname, mimetype, size } = fileInfo;
    
    // Basis-Tags basierend auf Dateityp und -name
    const baseTags = ['uploaded', mimetype.split('/')[0]];
    
    // Spezifische Analyse basierend auf Dateityp
    if (mimetype.startsWith('image/')) {
      return await analyzeImage(filePath, baseTags, originalname);
    } else if (mimetype.startsWith('text/') || mimetype.includes('document')) {
      return await analyzeTextDocument(filePath, baseTags, originalname);
    } else if (mimetype === 'application/pdf') {
      return await analyzePDF(filePath, baseTags, originalname);
    } else {
      // Fallback: Analyse basierend auf Dateiname und Typ
      return await analyzeByFilename(originalname, mimetype, baseTags);
    }
    
  } catch (error) {
    console.error('Fehler bei der AI-Analyse:', error.message);
    // Fallback zu einfacher Tag-Generierung
    return generateFallbackTags(fileInfo);
  }
}

/**
 * Analysiert Bilder mit OpenAI Vision
 */
async function analyzeImage(filePath, baseTags, filename) {
  try {
    // Bild als Base64 einlesen
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeTypeFromPath(filePath);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analysiere dieses Bild und generiere 3-7 relevante Tags auf Deutsch. 
                     Fokussiere dich auf: Objekte, Szenen, Farben, Stimmung, Stil.
                     Antworte nur mit den Tags, getrennt durch Kommas, ohne zusätzlichen Text.
                     Beispiel: landschaft, natur, grün, berge, sonnig`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 100
    });
    
    const aiTags = response.choices[0].message.content
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    console.log(`AI-generierte Tags für Bild ${filename}:`, aiTags);
    return [...baseTags, ...aiTags];
    
  } catch (error) {
    console.error('Fehler bei der Bildanalyse:', error.message);
    return [...baseTags, 'bild', 'visual'];
  }
}

/**
 * Analysiert Textdokumente
 */
async function analyzeTextDocument(filePath, baseTags, filename) {
  try {
    // Text aus Datei lesen (erste 2000 Zeichen für Analyse)
    const textContent = fs.readFileSync(filePath, 'utf8').substring(0, 2000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `Analysiere diesen Textinhalt und generiere 3-6 relevante Tags auf Deutsch.
                   Fokussiere dich auf: Thema, Kategorie, Schlüsselwörter, Dokumenttyp.
                   
                   Text: "${textContent}"
                   
                   Antworte nur mit den Tags, getrennt durch Kommas, ohne zusätzlichen Text.
                   Beispiel: bericht, analyse, business, quartal`
        }
      ],
      max_tokens: 80
    });
    
    const aiTags = response.choices[0].message.content
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    console.log(`AI-generierte Tags für Text ${filename}:`, aiTags);
    return [...baseTags, ...aiTags];
    
  } catch (error) {
    console.error('Fehler bei der Textanalyse:', error.message);
    return [...baseTags, 'dokument', 'text'];
  }
}

/**
 * Analysiert PDF-Dateien (vereinfacht - nur basierend auf Dateiname)
 */
async function analyzePDF(filePath, baseTags, filename) {
  try {
    // Für PDF-Analyse würde man normalerweise eine PDF-Parser-Bibliothek verwenden
    // Hier verwenden wir eine vereinfachte Analyse basierend auf dem Dateinamen
    return await analyzeByFilename(filename, 'application/pdf', [...baseTags, 'pdf', 'dokument']);
    
  } catch (error) {
    console.error('Fehler bei der PDF-Analyse:', error.message);
    return [...baseTags, 'pdf', 'dokument'];
  }
}

/**
 * Analysiert Dateien basierend auf Dateiname und MIME-Type
 */
async function analyzeByFilename(filename, mimetype, baseTags) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `Basierend auf diesem Dateinamen und Dateityp, generiere 2-4 relevante Tags auf Deutsch:
                   
                   Dateiname: "${filename}"
                   Dateityp: "${mimetype}"
                   
                   Berücksichtige mögliche Inhalte, Zweck oder Kategorie der Datei.
                   Antworte nur mit den Tags, getrennt durch Kommas, ohne zusätzlichen Text.
                   Beispiel: präsentation, business, meeting`
        }
      ],
      max_tokens: 60
    });
    
    const aiTags = response.choices[0].message.content
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    console.log(`AI-generierte Tags für ${filename}:`, aiTags);
    return [...baseTags, ...aiTags];
    
  } catch (error) {
    console.error('Fehler bei der Dateiname-Analyse:', error.message);
    return generateFallbackTags({ originalname: filename, mimetype });
  }
}

/**
 * Fallback-Tag-Generierung ohne AI
 */
function generateFallbackTags(fileInfo) {
  const tags = ['uploaded', fileInfo.mimetype.split('/')[0]];
  
  const filename = fileInfo.originalname.toLowerCase();
  
  // Einfache Keyword-basierte Tag-Generierung
  if (filename.includes('report') || filename.includes('bericht')) tags.push('bericht');
  if (filename.includes('invoice') || filename.includes('rechnung')) tags.push('rechnung');
  if (filename.includes('contract') || filename.includes('vertrag')) tags.push('vertrag');
  if (filename.includes('presentation') || filename.includes('präsentation')) tags.push('präsentation');
  if (filename.includes('meeting') || filename.includes('meeting')) tags.push('meeting');
  if (filename.includes('photo') || filename.includes('foto')) tags.push('foto');
  if (filename.includes('screenshot')) tags.push('screenshot');
  
  return tags;
}

/**
 * Hilfsfunktion: MIME-Type aus Dateipfad ermitteln
 */
function getMimeTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
  analyzeFileWithAI
};