// Build-Script für Vercel Deployment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Vercel build process...');

try {
  // 1. Frontend Build
  console.log('📦 Building frontend...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Backend Dependencies kopieren
  console.log('📋 Copying backend dependencies...');
  
  // Erstelle api/node_modules falls nicht vorhanden
  const apiNodeModulesPath = path.join(__dirname, 'api', 'node_modules');
  if (!fs.existsSync(apiNodeModulesPath)) {
    fs.mkdirSync(apiNodeModulesPath, { recursive: true });
  }

  // Kopiere wichtige Backend-Module
  const backendModules = [
    'sqlite3',
    'multer', 
    'form-data',
    '@aws-sdk/client-s3',
    '@google/generative-ai'
  ];

  backendModules.forEach(module => {
    const srcPath = path.join(__dirname, 'backend', 'node_modules', module);
    const destPath = path.join(__dirname, 'api', 'node_modules', module);
    
    if (fs.existsSync(srcPath)) {
      console.log(`Copying ${module}...`);
      execSync(`cp -r "${srcPath}" "${destPath}"`, { stdio: 'inherit' });
    }
  });

  // 3. Environment Variables Check
  console.log('🔧 Checking environment variables...');
  const requiredEnvVars = [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID', 
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
    console.warn('Please set these in your Vercel dashboard under Settings > Environment Variables');
  } else {
    console.log('✅ All required environment variables are set');
  }

  console.log('✅ Build completed successfully!');
  console.log('🎯 Ready for Vercel deployment');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}