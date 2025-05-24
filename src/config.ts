// API Configuration
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://ai-file-manager.netlify.app/.netlify/functions'
  : 'http://localhost:3001';

export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}/${endpoint}`;
};

export const config = {
  apiBaseUrl: API_BASE_URL,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedFileTypes: [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'text/*',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-rar-compressed'
  ]
};