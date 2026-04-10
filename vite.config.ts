import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      includeAssets: [
        "icons/android/android-launchericon-192-192.png",
        "icons/android/android-launchericon-512-512.png",
        "icons/ios/180.png",
      ],
      manifest: {
        id: "/",
        name: 'KurirDev',
        short_name: 'KurirDev',
        description: 'Logistics and Delivery Management System',
        start_url: "/",
        display: "standalone",
        background_color: "#111827",
        theme_color: '#059669',
        orientation: "portrait",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "icons/android/android-launchericon-192-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/android/android-launchericon-192-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/android/android-launchericon-512-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/android/android-launchericon-512-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/ios/180.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
        screenshots: [
          {
            src: "/screenshots/dashboard-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Admin Dashboard",
          },
          {
            src: "/screenshots/dashboard-mobile.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Courier PWA",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2,woff,ttf}"],
        additionalManifestEntries: [
          { url: 'icons/android/android-launchericon-192-192.png', revision: null },
          { url: 'icons/android/android-launchericon-512-512.png', revision: null },
          { url: 'icons/ios/180.png', revision: null },
        ]
      },
    }),
  ],
  build: {
    // Disable module preloading to stop the browser from aggressively 
    // fetching sub-page chunks during the initial boot. This is critical
    // for reducing TBT and network congestion on low-end devices.
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React Core (Smallest footprint for initialization)
          if (id.includes('node_modules/react/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react-core';
          }
          // React DOM & Router (Evaluation bridge)
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react-dom-bridge';
          }
          // Core Utilities & Auth
          if (id.includes('node_modules/@supabase/') || id.includes('node_modules/axios/')) {
            return 'vendor-core-utils';
          }
          // Firebase core
          if (id.includes('node_modules/firebase/app/') || id.includes('node_modules/firebase/auth/') || id.includes('node_modules/firebase/firestore/')) {
            return 'vendor-firebase';
          }
          // UI Icons (Large library isolation)
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-ui-icons';
          }
          // State management
          if (id.includes('zustand')) {
            return 'vendor-zustand';
          }
          // Date utility
          if (id.includes('date-fns')) {
            return 'vendor-date';
          }
          // Heavy Dynamic Vendors (Lazy-loaded)
          if (id.includes('dexie')) {
            return 'vendor-dexie';
          }
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
            return 'vendor-pdf';
          }
          if (id.includes('recharts') || id.includes('d3')) {
            return 'vendor-charts';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
