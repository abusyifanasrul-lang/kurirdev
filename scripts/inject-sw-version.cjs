// scripts/inject-sw-version.cjs
// Inject build version (Git commit SHA) into service worker
// This ensures sw.js bytes change on every deployment, triggering browser update detection

const fs = require('fs');
const path = require('path');

// Get version from Vercel env or fallback to timestamp
const version = process.env.VERCEL_GIT_COMMIT_SHA || 
                process.env.VERCEL_GIT_COMMIT_REF || 
                Date.now().toString();

console.log(`🔧 [inject-sw-version] Injecting version: ${version}`);

// ✅ FIX: Baca dari TEMPLATE, tulis ke public/sw.js
// Template tidak pernah dimodifikasi → placeholder selalu ada
const templatePath = path.join(__dirname, '..', 'public', 'sw.template.js');
const outputPath = path.join(__dirname, '..', 'public', 'sw.js');

// Check if template exists
if (!fs.existsSync(templatePath)) {
  console.error(`❌ [inject-sw-version] Template not found: ${templatePath}`);
  process.exit(1);
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
}
