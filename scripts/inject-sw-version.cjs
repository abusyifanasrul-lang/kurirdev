// scripts/inject-sw-version.cjs
// Inject build version (Git commit SHA) into service worker
// This ensures sw.js bytes change on every deployment, triggering browser update detection

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get version from multiple sources (priority order)
let version = process.env.VERCEL_GIT_COMMIT_SHA;

if (!version) {
  console.log('⚠️  [inject-sw-version] VERCEL_GIT_COMMIT_SHA not found, trying local git...');
  try {
    version = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    console.log(`✅ [inject-sw-version] Got version from local git: ${version}`);
  } catch (err) {
    console.warn('⚠️  [inject-sw-version] Git not available, using timestamp');
    version = Date.now().toString();
  }
}

console.log(`🔧 [inject-sw-version] Injecting version: ${version}`);
console.log(`🔧 [inject-sw-version] Environment: ${process.env.VERCEL ? 'Vercel' : 'Local'}`);

// ✅ FIX: Baca dari TEMPLATE, tulis ke public/sw.js
// Template tidak pernah dimodifikasi → placeholder selalu ada
const templatePath = path.join(__dirname, '..', 'public', 'sw.template.js');
const outputPath = path.join(__dirname, '..', 'public', 'sw.js');

// Check if template exists
if (!fs.existsSync(templatePath)) {
  console.error(`❌ [inject-sw-version] Template not found: ${templatePath}`);
  process.exit(1);
}

// ✅ CRITICAL FIX: Delete existing sw.js to ensure fresh generation
if (fs.existsSync(outputPath)) {
  console.log(`🗑️  [inject-sw-version] Deleting existing sw.js to force regeneration...`);
  fs.unlinkSync(outputPath);
}

// Read template
let swContent = fs.readFileSync(templatePath, 'utf8');

// Replace placeholder with actual version
const originalContent = swContent;
swContent = swContent.replace(/__BUILD_VERSION__/g, version);

// Write to output
fs.writeFileSync(outputPath, swContent, 'utf8');

if (originalContent === swContent) {
  console.warn('⚠️  [inject-sw-version] Warning: No __BUILD_VERSION__ placeholder found in template');
  process.exit(1);
} else {
  console.log(`✅ [inject-sw-version] Successfully wrote sw.js with version: ${version}`);
  console.log(`✅ [inject-sw-version] Output path: ${outputPath}`);
  console.log(`✅ [inject-sw-version] File size: ${fs.statSync(outputPath).size} bytes`);
}
