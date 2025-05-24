# Pasi AI - Intelligenter Datei-Manager

Ein KI-gestützter Datei-Manager mit automatischer Ordnerorganisation, Benutzerauthentifizierung und intelligenter Suchfunktion.

## Features

### ✅ Implementiert
- **Login-System**: 3 Admin-Accounts (admin1/admin123, admin2/admin456, admin3/admin789)
- **AI-Dateiorganisation**: Automatische Kategorisierung in intelligente Ordner
- **AI-Suche**: Natürlichsprachliche Dateisuche mit KI-Antworten
- **Datei-Upload**: Drag & Drop und Button-Upload
- **Datei-Preview**: Bilder, PDFs und Textdateien
- **Datei-Download**: Verbesserte Download-Funktionalität
- **Responsive Design**: Optimiert für Desktop und Mobile

### 🔧 Technische Details
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + SQLite
- **AI-Integration**: Google Gemini API für Dateianalyse
- **Datei-Storage**: Lokales Dateisystem mit SQLite-Metadaten

## Installation & Setup

### Voraussetzungen
- Node.js (v16 oder höher)
- npm oder yarn

### 1. Repository klonen
```bash
git clone <repository-url>
cd ai-file-manager
```

### 2. Dependencies installieren
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 3. Umgebungsvariablen konfigurieren
```bash
cd backend
cp .env.example .env
# .env bearbeiten und GEMINI_API_KEY hinzufügen
```

### 4. Server starten
```bash
# Backend (Terminal 1)
cd backend
npm start

# Frontend (Terminal 2)
npm run dev
```

## Login-Daten

| Benutzer | Passwort | Rolle |
|----------|----------|-------|
| admin1   | admin123 | admin |
| admin2   | admin456 | admin |
| admin3   | admin789 | admin |

## Hosting & Deployment

### Option 1: Vercel + PlanetScale (Empfohlen)
**Vorteile**: Kostenlos, automatische Skalierung, globale CDN

**Setup**:
1. **Frontend auf Vercel**:
   - Repository mit Vercel verbinden
   - Build Command: `npm run build`
   - Output Directory: `dist`

2. **Backend auf Vercel**:
   - Separate Vercel-App für Backend
   - API Routes in `/api` Ordner verschieben
   - Serverless Functions verwenden

3. **Datenbank: PlanetScale**:
   - MySQL-kompatible serverlose Datenbank
   - Kostenloser Tier verfügbar
   - SQLite zu MySQL migrieren

### Option 2: Railway
**Vorteile**: Einfaches Deployment, integrierte Datenbank

**Setup**:
```bash
# Railway CLI installieren
npm install -g @railway/cli

# Projekt deployen
railway login
railway init
railway up
```

### Option 3: Heroku + PostgreSQL
**Vorteile**: Bewährte Plattform, Add-ons verfügbar

**Setup**:
```bash
# Heroku CLI verwenden
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

### Option 4: DigitalOcean App Platform
**Vorteile**: Volle Kontrolle, günstige Preise

**Setup**:
- GitHub Repository verbinden
- App Platform konfigurieren
- Managed Database hinzufügen

### Option 5: AWS (Vollständige Cloud-Lösung)
**Komponenten**:
- **Frontend**: S3 + CloudFront
- **Backend**: Lambda + API Gateway
- **Datenbank**: RDS (PostgreSQL)
- **Datei-Storage**: S3 Buckets
- **CDN**: CloudFront

## Datei-Storage Lösungen

### Für Produktion empfohlen:

1. **AWS S3**:
   ```javascript
   // AWS SDK integration
   const AWS = require('aws-sdk');
   const s3 = new AWS.S3();
   ```

2. **Cloudinary** (für Bilder):
   ```javascript
   // Automatische Bildoptimierung
   const cloudinary = require('cloudinary').v2;
   ```

3. **Google Cloud Storage**:
   ```javascript
   const { Storage } = require('@google-cloud/storage');
   ```

## Umgebungsvariablen für Produktion

```env
# Backend (.env)
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:port/db
GEMINI_API_KEY=your_gemini_api_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET_NAME=your_bucket_name

# Frontend (.env)
VITE_API_URL=https://your-backend-url.com
VITE_APP_ENV=production
```

## Performance-Optimierungen

### Frontend
- Code Splitting mit React.lazy()
- Image Lazy Loading
- Service Worker für Caching
- Bundle-Größe Optimierung

### Backend
- Redis für Session-Management
- Database Connection Pooling
- File Upload Streaming
- CDN für statische Assets

### Datenbank
- Indizierung für Suchanfragen
- Query-Optimierung
- Connection Pooling
- Read Replicas für Skalierung

## Sicherheit

### Implementiert
- Passwort-basierte Authentifizierung
- CORS-Konfiguration
- File-Type Validierung

### Für Produktion empfohlen
- JWT-Token statt Session-basierte Auth
- Passwort-Hashing (bcrypt)
- Rate Limiting
- HTTPS-Erzwingung
- Input Sanitization
- File Upload Limits

## Monitoring & Analytics

### Empfohlene Tools
- **Sentry**: Error Tracking
- **LogRocket**: Session Replay
- **Google Analytics**: User Analytics
- **Uptime Robot**: Server Monitoring

## Kosten-Schätzung (monatlich)

### Kleine Anwendung (< 1000 Benutzer)
- **Vercel**: $0 (Hobby Plan)
- **PlanetScale**: $0 (Hobby Plan)
- **Cloudinary**: $0 (Free Tier)
- **Gesamt**: ~$0-10/Monat

### Mittlere Anwendung (< 10.000 Benutzer)
- **Vercel Pro**: $20/Monat
- **PlanetScale Scaler**: $29/Monat
- **AWS S3**: ~$5/Monat
- **Gesamt**: ~$50-70/Monat

### Große Anwendung (> 10.000 Benutzer)
- **AWS/GCP**: $200-500/Monat
- **CDN**: $50-100/Monat
- **Monitoring**: $50/Monat
- **Gesamt**: $300-650/Monat

## Nächste Schritte

1. **Datenbank migrieren**: SQLite → PostgreSQL/MySQL
2. **File Storage**: Lokale Dateien → Cloud Storage (S3/GCS)
3. **Authentifizierung**: Einfache Passwörter → JWT + bcrypt
4. **Deployment**: Lokale Entwicklung → Cloud Hosting
5. **Monitoring**: Logging und Error Tracking hinzufügen

## Support

Bei Fragen oder Problemen:
1. Issues im GitHub Repository erstellen
2. Dokumentation überprüfen
3. Community Discord beitreten

---

**Entwickelt mit ❤️ und KI-Unterstützung**
