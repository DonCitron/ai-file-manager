// Vercel Serverless Function für File Upload
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { analyzeFileWithGemini, detectSimilarFiles, generateDuplicateGroupId } = require('../backend/geminiService');
const { uploadToR2, getDownloadUrl } = require('../backend/r2Service');
const { initDatabase, insertFile } = require('../backend/database');

// Multer für temporäre Datei-Uploads konfigurieren
const upload = multer({
  dest: '/tmp/uploads/', // Vercel tmp directory
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Multer middleware wrapper for Vercel
    await new Promise((resolve, reject) => {
      upload.array('files')(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
    }

    console.log('Dateien erfolgreich hochgeladen:', req.files);

    const results = [];

    for (const file of req.files) {
      try {
        console.log(`Verarbeite Datei mit erweiterter AI-Analyse: ${file.originalname}`);

        // AI-Analyse mit Gemini
        const aiAnalysis = await analyzeFileWithGemini(file.path, file.originalname, file.mimetype);
        console.log(`Erweiterte Gemini AI-Analyse für ${file.originalname}:`, aiAnalysis);

        // Duplikatserkennung
        const duplicateInfo = await detectSimilarFiles(file.originalname, aiAnalysis.contentHash, aiAnalysis.description);
        console.log(`Duplikatserkennung für ${file.originalname}:`, duplicateInfo);

        let finalPath = '';
        let r2ObjectKey = null;
        let storageType = 'local';

        try {
          // Versuche Upload zu Cloudflare R2
          console.log(`Uploading ${file.originalname} to Cloudflare R2...`);
          const timestamp = Date.now();
          const r2Key = `files/${timestamp}-${file.originalname}`;
          
          await uploadToR2(file.path, r2Key);
          
          r2ObjectKey = r2Key;
          finalPath = r2Key;
          storageType = 'r2';
          
          console.log(`Successfully uploaded ${file.originalname} to R2 with key: ${r2Key}`);
          
          // Temporäre Datei löschen nach erfolgreichem R2-Upload
          fs.unlinkSync(file.path);
          console.log(`Deleted temporary file: ${file.path}`);
          
          console.log(`✅ Datei ${file.originalname} erfolgreich zu R2 hochgeladen: ${r2Key}`);
          
        } catch (r2Error) {
          console.error(`Error uploading ${file.originalname} to R2:`, r2Error);
          console.log(`⚠️ R2 Upload fehlgeschlagen für ${file.originalname}, verwende lokalen Speicher: ${r2Error.message}`);
          
          // Fallback: Lokaler Speicher (nicht für Vercel geeignet, aber als Backup)
          const timestamp = Date.now();
          const localFileName = `${timestamp}-${file.originalname}`;
          finalPath = `/tmp/permanent_storage/${localFileName}`;
          
          // Erstelle permanent_storage Verzeichnis falls nicht vorhanden
          const permanentDir = '/tmp/permanent_storage';
          if (!fs.existsSync(permanentDir)) {
            fs.mkdirSync(permanentDir, { recursive: true });
          }
          
          // Datei in permanenten Speicher verschieben
          fs.renameSync(file.path, finalPath);
          console.log(`📁 Datei ${file.originalname} erfolgreich lokal gespeichert: ${finalPath}`);
        }

        // Datei-Informationen in Datenbank einfügen
        const fileData = {
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          path: finalPath,
          r2ObjectKey: r2ObjectKey,
          tags: JSON.stringify(aiAnalysis.tags),
          uploadDate: new Date().toISOString(),
          description: aiAnalysis.description,
          aiAnalysis: aiAnalysis.aiAnalysis,
          contentHash: aiAnalysis.contentHash,
          duplicateGroup: duplicateInfo.type === 'duplicate' ? generateDuplicateGroupId() : null,
          storageType: storageType
        };

        const fileId = await insertFile(fileData);
        console.log(`Datei ${file.originalname} (ID: ${fileId}) erfolgreich in Datenbank eingefügt.`);

        results.push({
          id: fileId,
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          storageType: storageType,
          r2ObjectKey: r2ObjectKey,
          aiAnalysis: aiAnalysis,
          duplicateInfo: duplicateInfo
        });

      } catch (error) {
        console.error(`Fehler beim Verarbeiten der Datei ${file.originalname}:`, error);
        results.push({
          name: file.originalname,
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: 'Alle Dateien erfolgreich hochgeladen und verarbeitet.',
      files: results
    });

  } catch (error) {
    console.error('Fehler beim Datei-Upload:', error);
    res.status(500).json({ error: 'Interner Server-Fehler beim Datei-Upload' });
  }
}