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
        "icons/icon-192.webp",
        "icons/icon-512.webp",
      ],
      manifest: {
        id: "/",
        name: 'KurirMe',
        short_name: 'KurirMe',
        description: 'Logistics and Delivery Management System',
        start_url: "/",
        display: "standalone",
        background_color: "#F4FEFF",
        theme_color: '#F4FEFF',
        orientation: "portrait",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "icons/icon-192.webp?v=2",
            sizes: "192x192",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "icons/icon-192.webp?v=2",
            sizes: "192x192",
            type: "image/webp",
            purpose: "maskable",
          },
          {
            src: "icons/icon-512.webp?v=2",
            sizes: "512x512",
            type: "image/webp",
            purpose: "any",
          },
          {
            src: "icons/icon-512.webp?v=2",
            sizes: "512x512",
            type: "image/webp",
            purpose: "maskable",
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
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2,woff,ttf,webp}"],
        additionalManifestEntries: [
          { url: 'icons/icon-192.webp', revision: null },
          { url: 'icons/icon-512.webp', revision: null },
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
