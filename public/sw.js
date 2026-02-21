import { precacheAndRoute } from 'workbox-precaching';

// Required for VitePWA injectManifest
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_VERSION = 'v1.0.4';
const CACHE_NAME = `kurirdev-${CACHE_VERSION}`;

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
});

// For update banner to know when to skipWaiting
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
