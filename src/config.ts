// API-Konfiguration für lokale Entwicklung und Vercel-Deployment
const isProduction = import.meta.env.PROD;
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

export const API_BASE_URL = isProduction || isVercel 
  ? '' // Vercel verwendet relative URLs
  : 'http://localhost:3000'; // Lokale Entwicklung

export const API_ENDPOINTS = {
  upload: `${API_BASE_URL}/api/upload`,
  files: `${API_BASE_URL}/api/files`,
  login: `${API_BASE_URL}/api/login`,
  download: `${API_BASE_URL}/api/download`,
  search: `${API_BASE_URL}/api/search`,
  duplicates: `${API_BASE_URL}/api/duplicates`,
  findSimilar: `${API_BASE_URL}/api/find-similar`
};

// Fallback für lokale Entwicklung wenn Backend auf Port 3000 läuft
export const LOCAL_API_ENDPOINTS = {
  upload: 'http://localhost:3000/upload',
  files: 'http://localhost:3000/files',
  login: 'http://localhost:3000/login',
  download: 'http://localhost:3000/download',
  search: 'http://localhost:3000/search',
  duplicates: 'http://localhost:3000/duplicates',
  findSimilar: 'http://localhost:3000/find-similar'
};

// Hilfsfunktion um die richtige API-URL zu bekommen
export function getApiUrl(endpoint: keyof typeof API_ENDPOINTS): string {
  // Für lokale Entwicklung, verwende immer die lokalen Backend-Endpunkte
  if (!isProduction && !isVercel) {
    return LOCAL_API_ENDPOINTS[endpoint];
  }
  
  // Für Produktion/Vercel, verwende die API-Endpunkte
  return API_ENDPOINTS[endpoint];
}