import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// Enhanced PWA Registration untuk Instant Delivery System
import { registerServiceWorker } from "./utils/notification";
import { offlineStorage } from "./services/offlineStorage";

// Initialize PWA features
const initializePWA = async () => {
  try {
    // Register enhanced service worker
    registerServiceWorker();
    
    // Initialize offline storage
    await offlineStorage.init();
    
    // Cleanup expired cache
    await offlineStorage.cleanupExpiredCache();
    
    console.log('[PWA] Instant Delivery System initialized');
  } catch (error) {
    console.error('[PWA] Failed to initialize:', error);
  }
};

// Initialize PWA features
initializePWA();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
