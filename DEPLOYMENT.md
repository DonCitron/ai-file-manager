# 🚀 Vercel Deployment Guide - AI File Manager

## 📋 Voraussetzungen

1. **GitHub Repository** - Code muss in einem GitHub Repository sein
2. **Vercel Account** - Kostenlos auf [vercel.com](https://vercel.com)
3. **Cloudflare R2** - Bereits konfiguriert ✅

## 🔧 Schritt-für-Schritt Deployment

### 1. Repository vorbereiten

```bash
# Falls noch nicht geschehen, Git Repository initialisieren
git init
git add .
git commit -m "Initial commit - AI File Manager"

# GitHub Repository erstellen und pushen
git remote add origin https://github.com/IHR-USERNAME/ai-file-manager.git
git push -u origin main
```

### 2. Vercel Deployment

1. **Vercel Dashboard öffnen**: https://vercel.com/dashboard
2. **"New Project" klicken**
3. **GitHub Repository importieren**
4. **Framework Preset**: "Vite" auswählen
5. **Deploy klicken**

### 3. Environment Variables konfigurieren

In Vercel Dashboard → Settings → Environment Variables:

```env
# Cloudflare R2 Configuration
R2_ENDPOINT=https://bc750fdc91c17d58053292757589c5ec.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=b15909e6156c9a8e76164394ddeeb9a6
R2_SECRET_ACCESS_KEY=[Ihr Secret Key]
R2_BUCKET_NAME=pasiai

# Optional: Gemini AI (für erweiterte Features)
GEMINI_API_KEY=[Ihr Gemini API Key]

# Node Environment
NODE_ENV=production
```

### 4. Build-Konfiguration

Die [`vercel.json`](vercel.json) ist bereits konfiguriert:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/server.js",
      "use": "@vercel/node"
    },
    {
      "src": "package.json", 
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ]
}
```

## 🎯 Nach dem Deployment

### ✅ Was funktioniert:

- **Frontend**: React-App mit Vite
- **API-Endpunkte**: Serverless Functions
- **File Upload**: Direkt zu Cloudflare R2
- **Datenbank**: SQLite (temporär pro Request)
- **Downloads**: Signierte R2-URLs
- **AI-Features**: Gemini Integration

### 🔗 API-Endpunkte:

- `POST /api/upload` - Datei-Upload
- `GET /api/files` - Dateien abrufen  
- `POST /api/login` - Benutzer-Login
- `GET /api/download/[filename]` - Datei-Download

### 🌐 Öffentlicher Zugang:

Nach dem Deployment erhalten Sie eine URL wie:
```
https://ihr-projekt-name.vercel.app
```

**Diese URL können Sie teilen!** Andere können:
- ✅ Dateien hochladen
- ✅ Dateien herunterladen
- ✅ AI-Features nutzen
- ✅ Sich mit Admin-Accounts anmelden

## 🔐 Standard-Login-Daten

```
Benutzer: admin1 | Passwort: admin123
Benutzer: admin2 | Passwort: admin456  
Benutzer: admin3 | Passwort: admin789
```

## 🛠️ Troubleshooting

### Problem: Build-Fehler
```bash
# Lokal testen
npm run build
npm run preview
```

### Problem: API-Fehler
- Environment Variables in Vercel prüfen
- Cloudflare R2-Credentials validieren
- Logs in Vercel Dashboard → Functions → View Function Logs

### Problem: Upload-Fehler
- R2-Bucket-Name prüfen: `pasiai`
- R2-Permissions prüfen
- File-Size-Limits (50MB)

## 📊 Monitoring

- **Vercel Analytics**: Automatisch aktiviert
- **Function Logs**: Vercel Dashboard → Functions
- **R2 Usage**: Cloudflare Dashboard → R2

## 🚀 Fertig!

Ihr AI File Manager ist jetzt öffentlich verfügbar und kann von jedem genutzt werden!

**Beispiel-URL**: `https://ai-file-manager-xyz.vercel.app`