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
    // Disable automatic modulePreload to prevent heavy vendor chunks
    // (vendor-pdf ~130KB, vendor-charts ~143KB) from loading on pages
    // that don't need them. Lazy-loaded chunks will still load on demand.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase core — dipakai semua user
          // NOTE: firebase/messaging & firebase/installations intentionally excluded
          // — they're only needed for courier push notifications (lazy-loaded via fcm.ts)
          if (id.includes('firebase/app') || id.includes('firebase/auth') || id.includes('firebase/firestore')) {
            return 'vendor-firebase';
          }
          // React core
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
          // State management
          if (id.includes('zustand')) {
            return 'vendor-zustand';
          }
          // Date utility
          if (id.includes('date-fns')) {
            return 'vendor-date';
          }
          // IndexedDB
          if (id.includes('dexie')) {
            return 'vendor-dexie';
          }
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
            return 'vendor-pdf';
          }
          if (id.includes('recharts') || id.includes('d3')) {
            return 'vendor-charts';
          }
          // Firebase messaging is lazy-loaded in App.tsx
          // to avoid bloat for non-courier roles.
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
