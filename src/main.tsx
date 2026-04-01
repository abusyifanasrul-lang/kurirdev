import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// Register PWA service worker is handled automatically by vite-plugin-pwa
// through the injectRegister: "auto" / registerType: "autoUpdate" settings

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
