const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs').promises;
const path = require('path');

let s3Client = null;
let isR2Available = false;

try {
  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      }
    });
    isR2Available = true;
  } else {
    console.log('R2 credentials not found - using local storage only');
  }
} catch (error) {
  console.warn('Failed to initialize R2 client:', error);
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ai-file-manager';

/**
 * Datei zu Cloudflare R2 hochladen
 * @param {string} filePath - Lokaler Pfad zur Datei
 * @param {string} fileName - Name der Datei in R2
 * @param {string} contentType - MIME-Type der Datei
 * @returns {Promise<string>} - R2 Object Key
 */
async function uploadToR2(filePath, fileName, contentType) {
  if (!isR2Available) {
    return { success: false, message: 'R2 not configured - using local storage' };
  }

  try {
    console.log(`Uploading ${fileName} to Cloudflare R2...`);
    
    // Datei lesen
    const fileBuffer = await fs.readFile(filePath);
    
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
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    console.log(`Successfully uploaded ${fileName} to R2 with key: ${objectKey}`);
    
    // Lokale temporäre Datei löschen
    try {
      await fs.unlink(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    } catch (deleteError) {
      console.warn(`Could not delete temporary file ${filePath}:`, deleteError.message);
    }
    
    return { success: true };
    
  } catch (error) {
    console.error(`Error uploading ${fileName} to R2:`, error);
    return { success: false, error };
  }
}

/**
 * Signierte URL für Download generieren
 * @param {string} objectKey - R2 Object Key
 * @param {number} expiresIn - Gültigkeitsdauer in Sekunden (default: 1 Stunde)
 * @returns {Promise<string>} - Signierte Download-URL
 */
async function getDownloadUrl(objectKey, expiresIn = 3600) {
  if (!isR2Available) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    console.log(`Generated download URL for ${objectKey}`);
    
    return signedUrl;
    
  } catch (error) {
    console.error(`Error generating download URL for ${objectKey}:`, error);
    return null;
  }
}

/**
 * Datei von R2 löschen
 * @param {string} objectKey - R2 Object Key
 * @returns {Promise<boolean>} - Erfolg
 */
async function deleteFromR2(objectKey) {
  if (!isR2Available) {
    return false;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    await s3Client.send(command);
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
  if (!isR2Available) {
    return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    await s3Client.send(command);
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
  if (!isR2Available) {
    return null;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });
    
    const response = await s3Client.send(command);
    
    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
    
  } catch (error) {
    console.error(`Error getting metadata for ${objectKey}:`, error);
    return null;
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
  if (!isR2Available) {
    return null;
  }

  try {
    const timestamp = Date.now();
    const objectKey = `files/${timestamp}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    return {
      uploadUrl: signedUrl,
      objectKey: objectKey,
    };
    
  } catch (error) {
    console.error(`Error generating upload URL for ${fileName}:`, error);
    return null;
  }
}

/**
 * R2 Verbindung testen
 * @returns {Promise<boolean>} - Verbindung erfolgreich
 */
async function testR2Connection() {
  if (!isR2Available) {
    return false;
  }

  try {
    const testKey = 'test-connection-' + Date.now();
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: 'test'
    }));
    return true;
  } catch (error) {
    console.warn('R2 connection test failed:', error);
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
  isR2Available,
  s3Client,
  BUCKET_NAME,
};