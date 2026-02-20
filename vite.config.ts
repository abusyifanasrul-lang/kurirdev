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
      includeAssets: [
        "icons/android/android-launchericon-192-192.png",
        "icons/android/android-launchericon-512-512.png",
        "icons/ios/180.png",
      ],
      manifest: {
        id: "/",
        name: "KurirDev - Sistem Manajemen Pengiriman",
        short_name: "KurirDev",
        description:
          "Sistem manajemen pengiriman profesional untuk admin dan kurir",
        start_url: "/",
        display: "standalone",
        background_color: "#111827",
        theme_color: "#4F46E5",
        orientation: "portrait",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "icons/android/android-launchericon-192-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icons/android/android-launchericon-512-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
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
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2,woff,ttf}"],
        additionalManifestEntries: [
          { url: 'icons/android/android-launchericon-192-192.png', revision: null },
          { url: 'icons/android/android-launchericon-512-512.png', revision: null },
          { url: 'icons/ios/180.png', revision: null },
        ],
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^(?!\/__).*/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:mp3|wav|ogg)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "audio-cache",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern:
              /^https:\/\/(?:n8n\.kurirdev\.my\.id|.*\.supabase\.co)\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
