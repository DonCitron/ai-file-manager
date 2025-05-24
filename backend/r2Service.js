const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

// Cloudflare R2 Client konfigurieren
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // z.B. https://your-account-id.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ai-file-manager';

/**
 * Datei zu Cloudflare R2 hochladen
 * @param {string} filePath - Lokaler Pfad zur Datei
 * @param {string} fileName - Name der Datei in R2
 * @param {string} contentType - MIME-Type der Datei
 * @returns {Promise<string>} - R2 Object Key
 */
async function uploadToR2(filePath, fileName, contentType) {
  try {
    console.log(`Uploading ${fileName} to Cloudflare R2...`);
    
    // Datei lesen
    const fileBuffer = fs.readFileSync(filePath);
    
    // Eindeutigen Key generieren
    const timestamp = Date.now();
    const objectKey = `files/${timestamp}-${fileName}`;
    
    // Upload-Parameter
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        'original-name': fileName,
        'upload-timestamp': timestamp.toString(),
      },
    };
    
    // Upload durchführen
    const command = new PutObjectCommand(uploadParams);
    await r2Client.send(command);
    
    console.log(`Successfully uploaded ${fileName} to R2 with key: ${objectKey}`);
    
    // Lokale temporäre Datei löschen
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    } catch (deleteError) {
      console.warn(`Could not delete temporary file ${filePath}:`, deleteError.message);
    }
    
    return objectKey;
    
  } catch (error) {
    console.error(`Error uploading ${fileName} to R2:`, error);
    throw new Error(`R2 Upload failed: ${error.message}`);
  }
}

/**
 * Signierte URL für Download generieren
 * @param {string} objectKey - R2 Object Key
 * @param {number} expiresIn - Gültigkeitsdauer in Sekunden (default: 1 Stunde)
 * @returns {Promise<string>} - Signierte Download-URL
 */
async function getDownloadUrl(objectKey, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    console.log(`Generated download URL for ${objectKey}`);
    
    return signedUrl;
    
  } catch (error) {
    console.error(`Error generating download URL for ${objectKey}:`, error);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
}

/**
 * Datei von R2 löschen
 * @param {string} objectKey - R2 Object Key
 * @returns {Promise<boolean>} - Erfolg
 */
async function deleteFromR2(objectKey) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    await r2Client.send(command);
    console.log(`Successfully deleted ${objectKey} from R2`);
    
    return true;
    
  } catch (error) {
    console.error(`Error deleting ${objectKey} from R2:`, error);
    return false;
  }
}

/**
 * Prüfen ob Datei in R2 existiert
 * @param {string} objectKey - R2 Object Key
 * @returns {Promise<boolean>} - Existiert
 */
async function fileExistsInR2(objectKey) {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    await r2Client.send(command);
    return true;
    
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    console.error(`Error checking if ${objectKey} exists in R2:`, error);
    return false;
  }
}

/**
 * Datei-Metadaten von R2 abrufen
 * @param {string} objectKey - R2 Object Key
 * @returns {Promise<Object>} - Metadaten
 */
async function getFileMetadata(objectKey) {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    const response = await r2Client.send(command);
    
    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
    
  } catch (error) {
    console.error(`Error getting metadata for ${objectKey}:`, error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Temporäre Upload-URL generieren (für direkten Upload vom Frontend)
 * @param {string} fileName - Dateiname
 * @param {string} contentType - MIME-Type
 * @param {number} expiresIn - Gültigkeitsdauer in Sekunden
 * @returns {Promise<Object>} - Upload-URL und Object Key
 */
async function getUploadUrl(fileName, contentType, expiresIn = 3600) {
  try {
    const timestamp = Date.now();
    const objectKey = `files/${timestamp}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });
    
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    
    return {
      uploadUrl: signedUrl,
      objectKey: objectKey,
    };
    
  } catch (error) {
    console.error(`Error generating upload URL for ${fileName}:`, error);
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
}

/**
 * R2 Verbindung testen
 * @returns {Promise<boolean>} - Verbindung erfolgreich
 */
async function testR2Connection() {
  try {
    // Versuche Bucket-Informationen abzurufen
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test-connection', // Diese Datei muss nicht existieren
    });
    
    await r2Client.send(command);
    return true;
    
  } catch (error) {
    if (error.name === 'NotFound') {
      // Bucket existiert, aber Datei nicht - das ist OK
      console.log('R2 connection test successful');
      return true;
    }
    console.error('R2 connection test failed:', error);
    return false;
  }
}

module.exports = {
  uploadToR2,
  getDownloadUrl,
  deleteFromR2,
  fileExistsInR2,
  getFileMetadata,
  getUploadUrl,
  testR2Connection,
  r2Client,
  BUCKET_NAME,
};