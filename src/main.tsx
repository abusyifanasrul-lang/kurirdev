import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// Global error listener to handle dynamic import failures (e.g., stale service worker)
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

// Setup push notification listener on the SW
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then(() => {
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
