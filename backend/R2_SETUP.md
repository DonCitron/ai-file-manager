# Cloudflare R2 Setup für AI File Manager

## Übersicht

Dieser AI File Manager unterstützt jetzt Cloudflare R2 Object Storage als primäre Speicherlösung mit automatischem Fallback auf lokalen Speicher.

## Cloudflare R2 Konfiguration

### 1. R2 Bucket erstellen

1. Melden Sie sich bei Cloudflare Dashboard an
2. Navigieren Sie zu **R2 Object Storage**
3. Klicken Sie auf **Create bucket**
4. Geben Sie einen Bucket-Namen ein (z.B. `ai-file-manager`)
5. Wählen Sie eine Region (empfohlen: näher zu Ihren Benutzern)

### 2. API-Token erstellen

1. Gehen Sie zu **R2 Object Storage** > **Manage R2 API tokens**
2. Klicken Sie auf **Create API token**
3. Konfigurieren Sie die Berechtigung:
   - **Token name**: `ai-file-manager-token`
   - **Permissions**: `Object Read & Write`
   - **Bucket**: Wählen Sie Ihren erstellten Bucket
4. Kopieren Sie die generierten Credentials:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

### 3. Umgebungsvariablen konfigurieren

Erstellen Sie eine `.env` Datei im `backend` Verzeichnis:

```env
# Google Gemini AI API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Cloudflare R2 Configuration
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=ai-file-manager
```

**Wichtig**: Ersetzen Sie `your-account-id` in der Endpoint-URL mit Ihrer tatsächlichen Cloudflare Account-ID.

### 4. Abhängigkeiten installieren

```bash
cd backend
npm install
```

Die AWS SDK Pakete für R2 sind bereits in der `package.json` enthalten:
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

## Funktionsweise

### Upload-Prozess

1. **Primär**: Dateien werden zu Cloudflare R2 hochgeladen
2. **Fallback**: Bei R2-Fehlern wird automatisch lokaler Speicher verwendet
3. **Tracking**: Speichertyp wird in der Datenbank gespeichert (`storageType`: `r2` oder `local`)

### Download-Prozess

1. **R2-Dateien**: Generierung signierter URLs (1 Stunde gültig)
2. **Lokale Dateien**: Direkter Download vom Server
3. **Automatisch**: System erkennt Speichertyp und wählt entsprechende Methode

### Duplikatserkennung

- Content-Hash wird für alle Dateien generiert (unabhängig vom Speicherort)
- Duplikate werden erkannt, auch wenn sie in verschiedenen Speichern liegen

## Vorteile von Cloudflare R2

### Kosteneffizienz
- Keine Egress-Gebühren (Ausgangsverkehr kostenlos)
- Günstige Speicherkosten
- Nur für Speicher und API-Aufrufe zahlen

### Performance
- Globales CDN-Netzwerk
- Niedrige Latenz weltweit
- Automatische Skalierung

### Sicherheit
- Signierte URLs für sicheren Zugriff
- Automatische Verschlüsselung
- Granulare Zugriffskontrollen

## Überwachung und Logs

Der Server protokolliert automatisch:

```
✅ Cloudflare R2 connection successful
📤 Datei example.jpg erfolgreich zu R2 hochgeladen: files/1234567890-example.jpg
📥 Generiere R2 Download-URL für: example.jpg
⚠️ R2 Upload fehlgeschlagen, verwende lokalen Speicher
📁 Lokaler Download für: example.jpg
```

## Fehlerbehebung

### R2-Verbindung fehlgeschlagen

1. **Überprüfen Sie die Credentials**:
   - Access Key ID korrekt?
   - Secret Access Key korrekt?
   - Endpoint URL mit korrekter Account-ID?

2. **Bucket-Berechtigung**:
   - API-Token hat Zugriff auf den Bucket?
   - Bucket existiert in der angegebenen Region?

3. **Netzwerk**:
   - Firewall blockiert Cloudflare-Domains?
   - Proxy-Einstellungen korrekt?

### Fallback-Verhalten

Das System ist so konzipiert, dass es auch ohne R2 funktioniert:

- **Startup**: Warnung bei R2-Verbindungsfehlern, aber Server startet trotzdem
- **Upload**: Automatischer Fallback auf lokalen Speicher
- **Download**: Funktioniert für beide Speichertypen

### Debugging

Aktivieren Sie detaillierte Logs:

```env
NODE_ENV=development
DEBUG=r2:*
```

## Migration bestehender Dateien

Für bestehende lokale Dateien können Sie ein Migrations-Script erstellen:

```javascript
// migration-script.js
const { uploadToR2 } = require('./r2Service');
const fs = require('fs');
const path = require('path');

async function migrateLocalFilesToR2() {
  // Implementation für Migration
  // Liest lokale Dateien und lädt sie zu R2 hoch
  // Aktualisiert Datenbank-Einträge
}
```

## Sicherheitshinweise

1. **Niemals** R2-Credentials in den Code committen
2. Verwenden Sie `.env` Dateien für lokale Entwicklung
3. Nutzen Sie Umgebungsvariablen in der Produktion
4. Rotieren Sie API-Keys regelmäßig
5. Überwachen Sie R2-Nutzung im Cloudflare Dashboard

## Support

Bei Problemen:

1. Überprüfen Sie die Server-Logs
2. Testen Sie R2-Verbindung manuell
3. Kontaktieren Sie Cloudflare Support bei R2-spezifischen Problemen