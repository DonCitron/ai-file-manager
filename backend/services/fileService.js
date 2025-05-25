const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { analyzeFileWithGemini, detectSimilarFiles, generateDuplicateGroupId } = require('../geminiService');
const { uploadToR2, getDownloadUrl } = require('../r2Service');

/**
 * Service für Datei-Operationen
 */
class FileService {
  constructor(db, redisClient) {
    this.db = db;
    this.redisClient = redisClient;
    this.uploadDir = path.resolve(__dirname, '../uploads');
    this.permanentStorageDir = path.resolve(__dirname, '../permanent_storage');
  }

  /**
   * Initialisiert die erforderlichen Verzeichnisse
   */
  async initializeDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.permanentStorageDir, { recursive: true });
      console.log('✅ Verzeichnisse initialisiert');
    } catch (error) {
      console.error('❌ Fehler bei der Verzeichnis-Initialisierung:', error);
      throw error;
    }
  }

  /**
   * Verarbeitet eine hochgeladene Datei
   */
  async processUploadedFile(file, userId) {
    const startTime = Date.now();
    let tempPath = file.path;
    
    try {
      console.log(`📁 Verarbeite Datei: ${file.originalname}`);

      // 1. AI-Analyse
      const analysisResult = await this.analyzeFile(file, tempPath);

      // 2. Duplikatserkennung
      const duplicateInfo = await this.checkDuplicates(file, analysisResult);

      // 3. Datei speichern (R2 oder lokal)
      const storageResult = await this.storeFile(tempPath, file);

      // 4. Metadaten in Datenbank speichern
      const fileRecord = await this.saveFileMetadata({
        file,
        analysisResult,
        duplicateInfo,
        storageResult,
        userId
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Datei ${file.originalname} in ${processingTime}ms verarbeitet`);

      return {
        success: true,
        fileId: fileRecord.id,
        fileName: fileRecord.name,
        processingTime,
        analysis: analysisResult,
        storage: storageResult.type
      };

    } catch (error) {
      console.error(`❌ Fehler bei der Verarbeitung von ${file.originalname}:`, error);
      
      // Aufräumen bei Fehler
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        console.error('Fehler beim Aufräumen:', cleanupError);
      }

      throw error;
    }
  }

  /**
   * Führt AI-Analyse der Datei durch
   */
  async analyzeFile(file, filePath) {
    try {
      const result = await analyzeFileWithGemini(file, filePath);
      return result;
    } catch (error) {
      console.warn('⚠️ AI-Analyse fehlgeschlagen, verwende Fallback:', error.message);
      
      // Fallback-Analyse
      return {
        tags: this.generateFallbackTags(file),
        description: `${file.originalname} - Automatisch hochgeladen`,
        aiAnalysis: 'Fallback-Analyse verwendet',
        contentHash: await this.generateFileHash(filePath)
      };
    }
  }

  /**
   * Prüft auf Duplikate
   */
  async checkDuplicates(file, analysisResult) {
    try {
      const duplicateInfo = await detectSimilarFiles(file, analysisResult, this.db);
      return duplicateInfo;
    } catch (error) {
      console.error('⚠️ Duplikatserkennung fehlgeschlagen:', error);
      return { type: 'unknown', duplicates: [], confidence: 0 };
    }
  }

  /**
   * Speichert die Datei (R2 oder lokal)
   */
  async storeFile(tempPath, file) {
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    
    try {
      // Versuche R2 Upload
      const r2ObjectKey = await uploadToR2(tempPath, file.originalname, file.mimetype);
      
      // Bei Erfolg, temporäre Datei löschen
      await fs.unlink(tempPath);
      
      return {
        type: 'r2',
        path: r2ObjectKey,
        r2ObjectKey: r2ObjectKey
      };
    } catch (r2Error) {
      console.warn('⚠️ R2 Upload fehlgeschlagen, verwende lokalen Speicher:', r2Error.message);
      
      // Fallback zu lokalem Speicher
      const permanentPath = path.join(this.permanentStorageDir, uniqueFilename);
      await fs.rename(tempPath, permanentPath);
      
      return {
        type: 'local',
        path: permanentPath,
        r2ObjectKey: null
      };
    }
  }

  /**
   * Speichert Datei-Metadaten in der Datenbank
   */
  async saveFileMetadata({ file, analysisResult, duplicateInfo, storageResult, userId }) {
    const uploadDate = new Date().toISOString();
    const tagsString = JSON.stringify(analysisResult.tags);
    const duplicateGroup = duplicateInfo.type === 'exact' ? generateDuplicateGroupId() : null;
    const uniqueFilename = `${Date.now()}-${file.originalname}`;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO files (
          name, originalName, type, size, path, r2ObjectKey, 
          tags, uploadDate, description, aiAnalysis, 
          contentHash, duplicateGroup, storageType, userId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uniqueFilename,
          file.originalname,
          file.mimetype,
          file.size,
          storageResult.path,
          storageResult.r2ObjectKey,
          tagsString,
          uploadDate,
          analysisResult.description,
          analysisResult.aiAnalysis,
          analysisResult.contentHash,
          duplicateGroup,
          storageResult.type,
          userId
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              name: uniqueFilename,
              originalName: file.originalname
            });
          }
        }
      );
    });
  }

  /**
   * Sucht Dateien mit erweiterten Filteroptionen
   */
  async searchFiles({ query, tags, userId, type, dateFrom, dateTo, limit = 50, offset = 0 }) {
    let sql = 'SELECT * FROM files WHERE userId = ?';
    const params = [userId];

    // Suchbegriff
    if (query) {
      sql += ' AND (name LIKE ? OR originalName LIKE ? OR description LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Tags-Filter
    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    // Typ-Filter
    if (type) {
      sql += ' AND type LIKE ?';
      params.push(`${type}%`);
    }

    // Datums-Filter
    if (dateFrom) {
      sql += ' AND uploadDate >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND uploadDate <= ?';
      params.push(dateTo);
    }

    // Sortierung und Pagination
    sql += ' ORDER BY uploadDate DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Tags von JSON-String zu Array konvertieren
          const files = rows.map(file => ({
            ...file,
            tags: file.tags ? JSON.parse(file.tags) : []
          }));
          resolve(files);
        }
      });
    });
  }

  /**
   * Löscht eine Datei
   */
  async deleteFile(fileId, userId) {
    return new Promise(async (resolve, reject) => {
      // Erst Datei-Info abrufen
      this.db.get(
        'SELECT * FROM files WHERE id = ? AND userId = ?',
        [fileId, userId],
        async (err, file) => {
          if (err) return reject(err);
          if (!file) return reject(new Error('Datei nicht gefunden'));

          try {
            // Datei physisch löschen
            if (file.storageType === 'local' && file.path) {
              try {
                await fs.unlink(file.path);
              } catch (unlinkError) {
                console.warn('Datei konnte nicht gelöscht werden:', unlinkError);
              }
            }
            // Bei R2 müsste hier die R2 Delete API aufgerufen werden

            // Aus Datenbank löschen
            this.db.run(
              'DELETE FROM files WHERE id = ? AND userId = ?',
              [fileId, userId],
              function(deleteErr) {
                if (deleteErr) reject(deleteErr);
                else resolve({ deleted: this.changes > 0 });
              }
            );
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Generiert einen Hash für die Datei
   */
  async generateFileHash(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error('Fehler beim Generieren des Datei-Hash:', error);
      return null;
    }
  }

  /**
   * Generiert Fallback-Tags
   */
  generateFallbackTags(file) {
    const tags = ['uploaded'];
    
    // MIME-Type Tag
    if (file.mimetype) {
      const typeTag = file.mimetype.split('/')[0];
      tags.push(typeTag);
    }

    // Dateiname-basierte Tags
    const filename = file.originalname.toLowerCase();
    const keywords = ['report', 'invoice', 'contract', 'presentation', 'image', 'document'];
    
    keywords.forEach(keyword => {
      if (filename.includes(keyword)) {
        tags.push(keyword);
      }
    });

    return tags;
  }

  /**
   * Holt Datei-Statistiken für einen Benutzer
   */
  async getUserStatistics(userId) {
    return new Promise((resolve, reject) => {
      const queries = {
        totalFiles: 'SELECT COUNT(*) as count FROM files WHERE userId = ?',
        totalSize: 'SELECT SUM(size) as total FROM files WHERE userId = ?',
        fileTypes: 'SELECT type, COUNT(*) as count FROM files WHERE userId = ? GROUP BY type',
        recentFiles: 'SELECT * FROM files WHERE userId = ? ORDER BY uploadDate DESC LIMIT 5',
        topTags: `
          SELECT tag, COUNT(*) as count 
          FROM (
            SELECT json_each.value as tag 
            FROM files, json_each(files.tags) 
            WHERE userId = ?
          ) 
          GROUP BY tag 
          ORDER BY count DESC 
          LIMIT 10
        `
      };

      const stats = {};
      const promises = [];

      for (const [key, query] of Object.entries(queries)) {
        promises.push(
          new Promise((res, rej) => {
            const method = key === 'totalFiles' || key === 'totalSize' ? 'get' : 'all';
            this.db[method](query, [userId], (err, result) => {
              if (err) rej(err);
              else {
                stats[key] = result;
                res();
              }
            });
          })
        );
      }

      Promise.all(promises)
        .then(() => resolve(stats))
        .catch(reject);
    });
  }

  async getFileById(fileId) {
    if (this.redisClient) {
      const cached = await this.redisClient.get(`file:${fileId}`);
      if (cached) return JSON.parse(cached);
    }
    // ... fetch from DB ...
    if (this.redisClient) await this.redisClient.set(`file:${fileId}`, JSON.stringify(file), { EX: 3600 });
    return file;
  }
}

module.exports = FileService;
