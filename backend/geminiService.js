const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Gemini AI Client initialisieren
// WICHTIG: Sie müssen Ihren Gemini API Key als Umgebungsvariable setzen
// Beispiel: export GEMINI_API_KEY="your-api-key-here"
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Erweiterte Dateianalyse mit Gemini Pro - generiert Tags, Beschreibung und Content-Hash
 * @param {Object} fileInfo - Informationen über die Datei
 * @param {string} fileInfo.originalname - Originaler Dateiname
 * @param {string} fileInfo.mimetype - MIME-Type der Datei
 * @param {number} fileInfo.size - Dateigröße in Bytes
 * @param {string} filePath - Pfad zur Datei
 * @returns {Promise<Object>} Objekt mit tags, description, aiAnalysis und contentHash
 */
async function analyzeFileWithGemini(fileInfo, filePath) {
  try {
    console.log(`Erweiterte Gemini AI-Analyse gestartet für: ${fileInfo.originalname}`);
    
    const { originalname, mimetype, size } = fileInfo;
    
    // Content-Hash für Duplikatserkennung generieren
    const contentHash = await generateContentHash(filePath);
    
    // Basis-Tags basierend auf Dateityp und -name
    const baseTags = ['uploaded', mimetype.split('/')[0]];
    
    let analysisResult;
    
    // Spezifische Analyse basierend auf Dateityp
    if (mimetype.startsWith('image/')) {
      analysisResult = await analyzeImageWithGemini(filePath, baseTags, originalname);
    } else if (mimetype.startsWith('text/') || mimetype.includes('document')) {
      analysisResult = await analyzeTextWithGemini(filePath, baseTags, originalname);
    } else if (mimetype === 'application/pdf') {
      analysisResult = await analyzePDFWithGemini(filePath, baseTags, originalname);
    } else {
      // Fallback: Analyse basierend auf Dateiname und Typ
      analysisResult = await analyzeByFilenameWithGemini(originalname, mimetype, baseTags);
    }
    
    // Erweiterte Analyse-Ergebnisse zurückgeben
    return {
      tags: analysisResult.tags || analysisResult,
      description: analysisResult.description || `${originalname} - ${mimetype}`,
      aiAnalysis: analysisResult.aiAnalysis || 'Automatisch analysiert',
      contentHash: contentHash
    };
    
  } catch (error) {
    console.error('Fehler bei der erweiterten Gemini AI-Analyse:', error.message);
    // Fallback zu einfacher Tag-Generierung
    const fallbackTags = generateFallbackTags(fileInfo);
    return {
      tags: fallbackTags,
      description: `${fileInfo.originalname} - Automatisch hochgeladen`,
      aiAnalysis: 'Fallback-Analyse verwendet',
      contentHash: await generateContentHash(filePath).catch(() => 'unknown')
    };
  }
}

/**
 * Erweiterte Bildanalyse mit Gemini Pro Vision
 */
async function analyzeImageWithGemini(filePath, baseTags, filename) {
  try {
    // Gemini 1.5 Flash Model verwenden (ersetzt gemini-pro-vision)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Bild als Base64 einlesen
    const imageBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeTypeFromPath(filePath);
    
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType
      }
    };
    
    // Erweiterte Analyse für Tags und Beschreibung
    const tagPrompt = `Analysiere dieses Bild und generiere 3-7 relevante Tags auf Deutsch.
                      Fokussiere dich auf: Objekte, Szenen, Farben, Stimmung, Stil.
                      Antworte nur mit den Tags, getrennt durch Kommas, ohne zusätzlichen Text.
                      Beispiel: landschaft, natur, grün, berge, sonnig`;
    
    const descriptionPrompt = `Beschreibe dieses Bild in 1-2 prägnanten deutschen Sätzen.
                              Fokussiere dich auf die wichtigsten visuellen Elemente und den Gesamteindruck.
                              Antworte nur mit der Beschreibung, ohne zusätzlichen Text.`;
    
    // Tags generieren
    const tagResult = await model.generateContent([tagPrompt, imagePart]);
    const tagResponse = await tagResult.response;
    const tagText = tagResponse.text();
    
    // Beschreibung generieren
    const descResult = await model.generateContent([descriptionPrompt, imagePart]);
    const descResponse = await descResult.response;
    const description = descResponse.text().trim();
    
    const aiTags = tagText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && !tag.includes('.') && !tag.includes('beispiel'));
    
    console.log(`Gemini-generierte Tags für Bild ${filename}:`, aiTags);
    console.log(`Gemini-generierte Beschreibung für Bild ${filename}:`, description);
    
    return {
      tags: [...baseTags, ...aiTags],
      description: description,
      aiAnalysis: `Bildanalyse: ${aiTags.length} Tags generiert, Beschreibung erstellt`
    };
    
  } catch (error) {
    console.error('Fehler bei der erweiterten Gemini Bildanalyse:', error.message);
    return {
      tags: [...baseTags, 'bild', 'visual'],
      description: `Bild: ${filename}`,
      aiAnalysis: 'Fallback-Bildanalyse verwendet'
    };
  }
}

/**
 * Erweiterte Textdokument-Analyse mit Gemini Pro
 */
async function analyzeTextWithGemini(filePath, baseTags, filename) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Text aus Datei lesen (erste 3000 Zeichen für Analyse)
    const textContent = fs.readFileSync(filePath, 'utf8').substring(0, 3000);
    
    const tagPrompt = `Analysiere diesen Textinhalt und generiere 3-6 relevante Tags auf Deutsch.
                      Fokussiere dich auf: Thema, Kategorie, Schlüsselwörter, Dokumenttyp.
                      
                      Text: "${textContent}"
                      
                      Antworte nur mit den Tags, getrennt durch Kommas, ohne zusätzlichen Text.
                      Beispiel: bericht, analyse, business, quartal`;
    
    const descriptionPrompt = `Erstelle eine prägnante Zusammenfassung dieses Textdokuments in 1-2 deutschen Sätzen.
                              Fokussiere dich auf den Hauptinhalt und Zweck des Dokuments.
                              
                              Text: "${textContent}"
                              
                              Antworte nur mit der Zusammenfassung, ohne zusätzlichen Text.`;
    
    // Tags generieren
    const tagResult = await model.generateContent(tagPrompt);
    const tagResponse = await tagResult.response;
    const tagText = tagResponse.text();
    
    // Beschreibung generieren
    const descResult = await model.generateContent(descriptionPrompt);
    const descResponse = await descResult.response;
    const description = descResponse.text().trim();
    
    const aiTags = tagText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && !tag.includes('.') && !tag.includes('beispiel'));
    
    console.log(`Gemini-generierte Tags für Text ${filename}:`, aiTags);
    console.log(`Gemini-generierte Beschreibung für Text ${filename}:`, description);
    
    return {
      tags: [...baseTags, ...aiTags],
      description: description,
      aiAnalysis: `Textanalyse: ${textContent.length} Zeichen analysiert, ${aiTags.length} Tags generiert`
    };
    
  } catch (error) {
    console.error('Fehler bei der erweiterten Gemini Textanalyse:', error.message);
    return {
      tags: [...baseTags, 'dokument', 'text'],
      description: `Textdokument: ${filename}`,
      aiAnalysis: 'Fallback-Textanalyse verwendet'
    };
  }
}

/**
 * Erweiterte PDF-Analyse mit Gemini Pro
 */
async function analyzePDFWithGemini(filePath, baseTags, filename) {
  try {
    // Für PDF-Analyse verwenden wir eine erweiterte Dateiname-basierte Analyse
    const result = await analyzeByFilenameWithGemini(filename, 'application/pdf', [...baseTags, 'pdf', 'dokument']);
    
    return {
      tags: result.tags || result,
      description: result.description || `PDF-Dokument: ${filename}`,
      aiAnalysis: result.aiAnalysis || 'PDF-Dateiname-Analyse durchgeführt'
    };
    
  } catch (error) {
    console.error('Fehler bei der erweiterten Gemini PDF-Analyse:', error.message);
    return {
      tags: [...baseTags, 'pdf', 'dokument'],
      description: `PDF-Dokument: ${filename}`,
      aiAnalysis: 'Fallback-PDF-Analyse verwendet'
    };
  }
}

/**
 * Erweiterte Dateiname-basierte Analyse mit Gemini Pro
 */
async function analyzeByFilenameWithGemini(filename, mimetype, baseTags) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const tagPrompt = `Basierend auf diesem Dateinamen und Dateityp, generiere 2-4 relevante Tags auf Deutsch:
                      
                      Dateiname: "${filename}"
                      Dateityp: "${mimetype}"
                      
                      Berücksichtige mögliche Inhalte, Zweck oder Kategorie der Datei.
                      Antworte nur mit den Tags, getrennt durch Kommas, ohne zusätzlichen Text.
                      Beispiel: präsentation, business, meeting`;
    
    const descriptionPrompt = `Erstelle eine kurze, aussagekräftige Beschreibung für diese Datei auf Deutsch:
                              
                              Dateiname: "${filename}"
                              Dateityp: "${mimetype}"
                              
                              Berücksichtige den wahrscheinlichen Inhalt und Zweck der Datei.
                              Antworte nur mit der Beschreibung in 1 Satz, ohne zusätzlichen Text.`;
    
    // Tags generieren
    const tagResult = await model.generateContent(tagPrompt);
    const tagResponse = await tagResult.response;
    const tagText = tagResponse.text();
    
    // Beschreibung generieren
    const descResult = await model.generateContent(descriptionPrompt);
    const descResponse = await descResult.response;
    const description = descResponse.text().trim();
    
    const aiTags = tagText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && !tag.includes('.') && !tag.includes('beispiel'));
    
    console.log(`Gemini-generierte Tags für ${filename}:`, aiTags);
    console.log(`Gemini-generierte Beschreibung für ${filename}:`, description);
    
    return {
      tags: [...baseTags, ...aiTags],
      description: description,
      aiAnalysis: `Dateiname-Analyse: ${aiTags.length} Tags generiert basierend auf "${filename}"`
    };
    
  } catch (error) {
    console.error('Fehler bei der erweiterten Gemini Dateiname-Analyse:', error.message);
    const fallbackTags = generateFallbackTags({ originalname: filename, mimetype });
    return {
      tags: fallbackTags,
      description: `Datei: ${filename}`,
      aiAnalysis: 'Fallback-Dateiname-Analyse verwendet'
    };
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

/**
 * Generiert einen Content-Hash für Duplikatserkennung
 */
async function generateContentHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  } catch (error) {
    console.error('Fehler beim Generieren des Content-Hash:', error.message);
    return null;
  }
}

/**
 * Prüft auf Duplikate basierend auf Content-Hash
 */
async function checkForDuplicates(contentHash, db) {
  return new Promise((resolve, reject) => {
    if (!contentHash) {
      resolve([]);
      return;
    }
    
    const query = `SELECT id, name, path, description FROM files WHERE contentHash = ? AND contentHash IS NOT NULL`;
    
    db.all(query, [contentHash], (err, rows) => {
      if (err) {
        console.error('Fehler bei der Duplikatsprüfung:', err.message);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Generiert eine Duplikat-Gruppe-ID
 */
function generateDuplicateGroupId() {
  return `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Erweiterte Duplikatserkennung mit AI-Analyse
 */
async function detectSimilarFiles(fileInfo, analysisResult, db) {
  try {
    // 1. Exakte Duplikate über Content-Hash
    const exactDuplicates = await checkForDuplicates(analysisResult.contentHash, db);
    
    if (exactDuplicates.length > 0) {
      console.log(`Exakte Duplikate gefunden für ${fileInfo.originalname}:`, exactDuplicates.length);
      return {
        type: 'exact',
        duplicates: exactDuplicates,
        confidence: 100
      };
    }
    
    // 2. Ähnliche Dateien über Tags und Beschreibung (vereinfacht)
    const similarFiles = await findSimilarFilesByTags(analysisResult.tags, fileInfo.mimetype, db);
    
    if (similarFiles.length > 0) {
      console.log(`Ähnliche Dateien gefunden für ${fileInfo.originalname}:`, similarFiles.length);
      return {
        type: 'similar',
        duplicates: similarFiles,
        confidence: 75
      };
    }
    
    return {
      type: 'unique',
      duplicates: [],
      confidence: 0
    };
    
  } catch (error) {
    console.error('Fehler bei der Duplikatserkennung:', error.message);
    return {
      type: 'unknown',
      duplicates: [],
      confidence: 0
    };
  }
}

/**
 * Findet ähnliche Dateien basierend auf Tags
 */
async function findSimilarFilesByTags(tags, mimetype, db) {
  return new Promise((resolve, reject) => {
    if (!tags || tags.length === 0) {
      resolve([]);
      return;
    }
    
    // Suche nach Dateien mit ähnlichen Tags (mindestens 2 gemeinsame Tags)
    const tagConditions = tags.slice(0, 5).map(() => "tags LIKE ?").join(' OR ');
    const query = `
      SELECT id, name, path, description, tags
      FROM files
      WHERE type = ? AND (${tagConditions})
      ORDER BY uploadDate DESC
      LIMIT 10
    `;
    
    const params = [mimetype, ...tags.slice(0, 5).map(tag => `%"${tag}"%`)];
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Fehler bei der Tag-basierten Ähnlichkeitssuche:', err.message);
        reject(err);
      } else {
        // Filtere Dateien mit mindestens 2 gemeinsamen Tags
        const similarFiles = rows.filter(file => {
          try {
            const fileTags = JSON.parse(file.tags || '[]');
            const commonTags = tags.filter(tag => fileTags.includes(tag));
            return commonTags.length >= 2;
          } catch (e) {
            return false;
          }
        });
        
        resolve(similarFiles);
      }
    });
  });
}

module.exports = {
  analyzeFileWithGemini,
  generateContentHash,
  checkForDuplicates,
  detectSimilarFiles,
  generateDuplicateGroupId
};