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
    // Restore stable module pre-loading. Disabling this entirely in a
    // fragmented chunk environment caused dependency discovery issues.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase core — shared across admin/owner
          if (id.includes('node_modules/firebase/app/') || id.includes('node_modules/firebase/auth/') || id.includes('node_modules/firebase/firestore/')) {
            return 'vendor-firebase';
          }
          // Precise matching for React core to avoid catching 
          // 'lucide-react' or other UI libraries with "react" in their name.
          // Combined React core bundle to avoid circular dependencies
          // while using precise matching to avoid catching 'lucide-react'.
          if (
            id.includes('node_modules/react/') || 
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
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
