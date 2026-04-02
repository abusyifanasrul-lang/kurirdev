/**
 * Fallback Service Worker for Firebase Messaging
 * Some browsers/SDK setups look specifically for this filename.
 * We import our main sw.js to keep all logic in one place.
 */
importScripts('/sw.js');
