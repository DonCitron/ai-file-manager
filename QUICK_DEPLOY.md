# 🚀 Schnelles Deployment - AI File Manager

## 📋 Was Sie brauchen:
1. **GitHub Account** (kostenlos)
2. **Vercel Account** (kostenlos)
3. **5 Minuten Zeit**

## 🔧 Schritt-für-Schritt:

### 1. Code zu GitHub hochladen

```bash
# Terminal öffnen in diesem Ordner und eingeben:
git init
git add .
git commit -m "AI File Manager - Ready for deployment"

# GitHub Repository erstellen auf github.com
# Dann hier eingeben (IHREN USERNAME einsetzen):
git remote add origin https://github.com/IHR-USERNAME/ai-file-manager.git
git branch -M main
git push -u origin main
```

### 2. Vercel Deployment

1. **Gehen Sie zu**: https://vercel.com
2. **"Sign up with GitHub"** klicken
3. **"New Project"** klicken
4. **Ihr Repository auswählen**: `ai-file-manager`
5. **Framework Preset**: "Vite" auswählen
6. **"Deploy"** klicken

### 3. Environment Variables hinzufügen

In Vercel Dashboard → Ihr Projekt → Settings → Environment Variables:

```
R2_ENDPOINT=https://bc750fdc91c17d58053292757589c5ec.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=b15909e6156c9a8e76164394ddeeb9a6
R2_SECRET_ACCESS_KEY=[Ihr R2 Secret Key aus .env]
R2_BUCKET_NAME=pasiai
GEMINI_API_KEY=[Ihr Gemini Key aus .env]
NODE_ENV=production
```

### 4. Redeploy

Nach dem Hinzufügen der Environment Variables:
- **"Deployments"** Tab
- **"Redeploy"** klicken

## 🎉 FERTIG!

Sie erhalten eine URL wie: `https://ai-file-manager-xyz.vercel.app`

**Diese URL können Sie teilen!** Jeder kann dann:
- ✅ Dateien hochladen
- ✅ Dateien herunterladen  
- ✅ AI-Features nutzen
- ✅ Sich anmelden (admin1/admin123, admin2/admin456, admin3/admin789)

## 🔐 Standard-Logins:
```
Benutzer: admin1 | Passwort: admin123
Benutzer: admin2 | Passwort: admin456
Benutzer: admin3 | Passwort: admin789
```

## 📱 Features für alle Nutzer:
- **Drag & Drop Upload**
- **AI-Kategorisierung** (automatisch)
- **Intelligente Tags**
- **Bildvorschau**
- **Download-Funktion**
- **Duplikatserkennung**
- **Responsive Design** (Handy + Desktop)

---

**Hinweis**: Die Datenbank wird bei Vercel temporär erstellt. Für permanente Speicherung können Sie später eine externe Datenbank hinzufügen.