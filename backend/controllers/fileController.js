// File Controller
// Handles file upload, download, and management logic

const path = require('path');
const fs = require('fs');
const { getDownloadUrl } = require('../r2Service');

module.exports = {
  async upload(req, res, fileService) {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
    }
    const results = [];
    const errors = [];
    for (const file of req.files) {
      try {
        const result = await fileService.processUploadedFile(file, req.user.id);
        results.push(result);
      } catch (error) {
        errors.push({ fileName: file.originalname, error: error.message });
      }
    }
    if (errors.length === 0) {
      res.json({ success: true, message: `${results.length} Dateien erfolgreich hochgeladen`, files: results });
    } else if (results.length > 0) {
      res.status(207).json({ partial: true, message: `${results.length} von ${req.files.length} Dateien hochgeladen`, files: results, errors });
    } else {
      res.status(500).json({ success: false, message: 'Keine Dateien konnten hochgeladen werden', errors });
    }
  },

  async getFiles(req, res, fileService) {
    const { search, tags, type, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;
    const files = await fileService.searchFiles({
      query: search,
      tags: tags ? tags.split(',') : null,
      userId: req.user.id,
      type,
      dateFrom,
      dateTo,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    res.json({ success: true, data: files, totalResults: files.length, pagination: { limit: parseInt(limit), offset: parseInt(offset) } });
  },

  async aiSearch(req, res, fileService) {
    const { query } = req.body;
    const files = await fileService.searchFiles({ query, userId: req.user.id, limit: 20 });
    let aiResponse = '';
    if (files.length === 0) {
      aiResponse = `Ich konnte keine Dateien finden, die "${query}" entsprechen. Versuchen Sie es mit anderen Suchbegriffen.`;
    } else if (files.length === 1) {
      aiResponse = `Ich habe 1 Datei gefunden: ${files[0].originalName || files[0].name}`;
    } else {
      const fileNames = files.slice(0, 3).map(f => f.originalName || f.name).join(', ');
      aiResponse = `Ich habe ${files.length} Dateien gefunden, darunter: ${fileNames}`;
    }
    res.json({ success: true, aiResponse, data: files, totalResults: files.length, searchQuery: query });
  },

  async download(req, res, db) {
    const filename = req.params.filename;
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE name = ? AND userId = ?', [filename, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    const originalName = file.originalName || filename;
    if (file.storageType === 'r2' && file.r2ObjectKey) {
      const downloadUrl = await getDownloadUrl(file.r2ObjectKey, 3600);
      res.redirect(downloadUrl);
    } else {
      const filePath = file.path || path.join(__dirname, '../permanent_storage', filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Lokale Datei nicht gefunden' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.sendFile(path.resolve(filePath));
    }
  },

  async deleteFile(req, res, fileService) {
    const fileId = parseInt(req.params.id);
    const result = await fileService.deleteFile(fileId, req.user.id);
    if (result.deleted) {
      res.json({ success: true, message: 'Datei erfolgreich gelöscht' });
    } else {
      res.status(404).json({ error: 'Datei nicht gefunden' });
    }
  },

  async getUserStats(req, res, fileService) {
    const stats = await fileService.getUserStatistics(req.user.id);
    res.json({ success: true, stats });
  },

  async findDuplicates(req, res, db) {
    const query = `SELECT duplicateGroup, COUNT(*) as count, GROUP_CONCAT(name) as fileNames, GROUP_CONCAT(id) as fileIds, GROUP_CONCAT(originalName) as originalNames FROM files WHERE duplicateGroup IS NOT NULL AND userId = ? GROUP BY duplicateGroup HAVING count > 1 ORDER BY count DESC`;
    const duplicates = await new Promise((resolve, reject) => {
      db.all(query, [req.user.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: duplicates, totalGroups: duplicates.length });
  },

  async findSimilar(req, res, db, fileService) {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: 'Datei-ID ist erforderlich' });
    }
    const file = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE id = ? AND userId = ?', [fileId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }
    const tags = JSON.parse(file.tags || '[]');
    if (tags.length === 0) {
      return res.json({ success: true, data: [], totalResults: 0 });
    }
    const similarFiles = await fileService.searchFiles({ tags: tags.slice(0, 5), userId: req.user.id, type: file.type, limit: 20 });
    const filteredFiles = similarFiles
      .filter(f => f.id !== fileId)
      .map(f => {
        const fileTags = f.tags || [];
        const commonTags = tags.filter(tag => fileTags.includes(tag));
        const similarity = (commonTags.length / Math.max(tags.length, fileTags.length)) * 100;
        return { ...f, similarity: Math.round(similarity), commonTags };
      })
      .filter(f => f.similarity >= 30)
      .sort((a, b) => b.similarity - a.similarity);
    res.json({ success: true, data: filteredFiles, totalResults: filteredFiles.length, originalTags: tags });
  },

  async adminGetUsers(req, res, db) {
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT id, username, email, role, lastLogin, createdAt FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.json({ success: true, data: users });
  },

  async previewFile(req, res, db) {
    const requestedFile = req.path;
    const userId = req.user.id;
    db.get('SELECT * FROM files WHERE name = ? AND userId = ?', [path.basename(requestedFile), userId], (err, file) => {
      if (err || !file) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }
      res.sendFile(path.join(__dirname, '../permanent_storage', requestedFile));
    });
  }
};
