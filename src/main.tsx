import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// ============================================================================
// VERSION CHECK & CACHE INVALIDATION
// ============================================================================
// CRITICAL FIX: Force cache clear when app version changes
// This prevents chunk version mismatch that causes "Cannot read properties of null (reading 'useCallback')"
const APP_VERSION = '1.0.10'; // INCREMENT ON EVERY DEPLOY

const storedVersion = localStorage.getItem('app_version');
if (storedVersion !== APP_VERSION) {
  console.log(`🔄 App version changed: ${storedVersion} → ${APP_VERSION}`);
  console.log('🧹 Clearing all caches and service workers...');
  
  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        console.log(`  Deleting cache: ${name}`);
        caches.delete(name);
      });
    });
  }
  
  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        console.log(`  Unregistering SW: ${reg.scope}`);
        reg.unregister();
      });
    });
  }
  
  // Update stored version
  localStorage.setItem('app_version', APP_VERSION);
  
  // Clear chunk retry flag
  localStorage.removeItem('chunk_load_retried');
  
  console.log('✅ Cache cleared. Reloading...');
  
  // Reload to get fresh chunks
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================
window.addEventListener('error', (event) => {
  const isChunkError = 
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Failed to load module script') ||
    event.message?.includes('Expected a JavaScript-or-Wasm module script');
    
  if (isChunkError) {
    console.error('Dynamic import failed (chunk error). Reloading...', event);
    window.location.reload();
  }
}, true);

// Also catch unhandled promise rejections for lazy load errors
window.addEventListener('unhandledrejection', (event) => {
  const isChunkError = 
    (event.reason instanceof TypeError && event.reason.message.includes('Failed to fetch dynamically imported module')) ||
    (event.reason?.message?.includes('Failed to load module script')) ||
    (event.reason?.message?.includes('Expected a JavaScript-or-Wasm module script'));

  if (isChunkError) {
    console.error('Dynamic import failed (unhandled rejection). Reloading...', event);
    window.location.reload();
  }
});

// Register Service Worker for PWA and Push Notifications
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { 
      scope: "/",
      updateViaCache: "none" // CRITICAL: Force browser to always check network for sw.js updates
    })
    .then((registration) => {
      console.log("✅ Service Worker registered:", registration.scope);
      
      // CRITICAL FIX: Check for updates every 60 seconds
      // This ensures browser actively checks for new SW versions
      setInterval(() => {
        registration.update().then(() => {
          console.log("🔄 Checked for service worker updates");
        }).catch(err => {
          console.error("❌ Update check failed:", err);
        });
      }, 60000); // Check every 60 seconds
      
      // Also check immediately on page load
      registration.update().catch(err => {
        console.error("❌ Initial update check failed:", err);
      });
      
      // Setup push notification listener
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "PUSH_NOTIFICATION") {
          // Play alert sound for foreground notifications
          const audio = new Audio("/alert.mp3");
          audio.volume = 1.0;
          audio.play().catch((err) =>
            console.error("Error playing audio:", err)
          );
          console.log("Foreground notification received:", event.data.payload);
        }
      });
    })
    .catch((error) => {
      console.error("❌ Service Worker registration failed:", error);
    });
}
import { clearAllCache } from './lib/orderCache';

if (!localStorage.getItem('supabase_migration_cleared_v2')) {
  console.log('Performing hard reset for Supabase migration...');
  clearAllCache().then(() => {
    localStorage.setItem('supabase_migration_cleared_v2', 'true');
    window.location.reload();
  }).catch(err => console.error('Cache clear error:', err));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
