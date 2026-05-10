// scripts/inject-sw-version.js
// Inject build version (Git commit SHA) into service worker
// This ensures sw.js bytes change on every deployment, triggering browser update detection

const fs = require('fs');
const path = require('path');

// Get version from Vercel env or fallback to timestamp
const version = process.env.VERCEL_GIT_COMMIT_SHA || 
                process.env.VERCEL_GIT_COMMIT_REF || 
                Date.now().toString();

console.log(`🔧 [inject-sw-version] Injecting version: ${version}`);

// Read sw.js
const swPath = path.join(__dirname, '..', 'public', 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Replace placeholder with actual version
const originalContent = swContent;
swContent = swContent.replace(/__BUILD_VERSION__/g, version);

// Write back
fs.writeFileSync(swPath, swContent, 'utf8');

if (originalContent === swContent) {
  console.warn('⚠️  [inject-sw-version] Warning: No __BUILD_VERSION__ placeholder found in sw.js');
} else {
  console.log(`✅ [inject-sw-version] Successfully injected version into sw.js`);
}
