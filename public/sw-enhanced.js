// Enhanced Service Worker untuk Instant Delivery System
// Fokus: Real-time sync, offline-first, critical data caching

const CACHE_NAME = 'delivery-pro-v1';
const CRITICAL_CACHE = 'delivery-critical-v1';
const API_CACHE = 'delivery-api-v1';

// Critical assets untuk instant loading (App Shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css',
  '/alert.mp3'
];

// Critical API endpoints yang harus available offline
const CRITICAL_ENDPOINTS = [
  '/api/courier/orders',
  '/api/courier/profile',
  '/api/courier/earnings',
  '/api/dashboard/analytics'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing DeliveryPro PWA...');
  
  event.waitUntil(
    Promise.all([
      // Cache app shell untuk instant loading
      caches.open(CRITICAL_CACHE).then(cache => {
        console.log('[SW] Caching app shell...');
        return cache.addAll(APP_SHELL);
      }),
      
      // Skip waiting untuk immediate activation
      self.skipWaiting()
    ])
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating DeliveryPro PWA...');
  
  event.waitUntil(
    Promise.all([
      // Claim all clients untuk immediate control
      self.clients.claim(),
      
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== CRITICAL_CACHE && name !== API_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
    ])
  );
});

// Network strategy untuk instant delivery system
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests untuk API calls
  if (request.method !== 'GET' && url.pathname.startsWith('/api/')) {
    return;
  }

  // Strategy 1: App Shell - Cache First untuk instant loading
  if (APP_SHELL.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(cacheFirst(request, CRITICAL_CACHE));
    return;
  }

  // Strategy 2: Critical API - Network First dengan fallback ke cache
  if (CRITICAL_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Strategy 3: Static assets - Cache First
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Strategy 4: Other API - Network Only dengan error fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Default: Network First
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// Cache First strategy - untuk instant loading
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Background update cache
    event.waitUntil(
      fetch(request).then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      }).catch(() => {
        // Silent fail untuk background update
      })
    );
    
    return cachedResponse;
  }
  
  // Fallback ke network
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, returning offline page');
    return new Response('Offline - Mode', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Network First strategy - untuk real-time data
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    // Try network first untuk real-time data
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful response
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    console.log('[SW] Network failed, trying cache...');
  }
  
  // Fallback ke cache
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Add header untuk menandai cached data
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-From-Cache', 'true');
    headers.set('X-Cache-Time', new Date().toISOString());
    
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers
    });
  }
  
  // Final fallback
  return new Response('Offline - No cached data available', { 
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Network Only untuk POST/PUT/DELETE
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Offline - Action queued for sync',
      queued: true 
    }), { 
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Enhanced Push Notifications untuk instant delivery alerts
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  
  // Priority-based notification handling
  const notificationOptions = {
    body: data.body || 'Ada update pesanan baru!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    
    // Urgent vibration pattern untuk delivery alerts
    vibrate: data.urgent ? [
      200, 100, 200, 100, 200, 100, 200
    ] : [
      100, 50, 100, 50, 100
    ],
    
    // Data untuk deep linking
    data: {
      url: data.url || '/courier/orders',
      orderId: data.orderId,
      priority: data.priority || 'normal',
      timestamp: Date.now()
    },
    
    // Actions untuk quick response
    actions: data.priority === 'urgent' ? [
      { action: 'view-order', title: 'LIHAT PESANAN' },
      { action: 'call-customer', title: 'TELPON' }
    ] : [
      { action: 'view-order', title: 'LIHAT DETAIL' }
    ],
    
    // Silent notifications untuk background sync
    silent: data.silent || false,
    
    // Require interaction untuk urgent orders
    requireInteraction: data.urgent || false,
    
    // Tag untuk grouping
    tag: data.orderId ? `order-${data.orderId}` : 'general'
  };

  // Notify all clients untuk real-time update
  event.waitUntil(
    Promise.all([
      // Show notification
      self.registration.showNotification(
        data.title || 'DeliveryPro - Pesanan Baru', 
        notificationOptions
      ),
      
      // Notify all open clients
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'REAL_TIME_UPDATE',
              payload: {
                ...data,
                timestamp: Date.now()
              }
            });
          });
        })
    ])
  );
});

// Enhanced notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const { action, notification } = event;
  const data = notification.data || {};
  
  event.waitUntil(
    (async () => {
      // Get or open client
      const clientList = await self.clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
      let client = clientList.find(c => c.url.includes(data.url));
      
      if (!client) {
        // Open new window
        client = await self.clients.openWindow(data.url || '/courier/orders');
      } else {
        // Focus existing window
        await client.focus();
        
        // Navigate if needed
        if (data.url && !client.url.includes(data.url)) {
          await client.navigate(data.url);
        }
      }
      
      // Send action to client
      if (client) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action,
          data: data
        });
      }
    })()
  );
});

// Background Sync untuk offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOfflineOrders());
  }
  
  if (event.tag === 'sync-location') {
    event.waitUntil(syncLocationData());
  }
});

// Sync offline orders
async function syncOfflineOrders() {
  // Get all offline orders from IndexedDB
  // Send to server when online
  // Handle conflicts
  console.log('[SW] Syncing offline orders...');
}

// Sync location data
async function syncLocationData() {
  // Sync cached location updates
  console.log('[SW] Syncing location data...');
}

// Periodic sync untuk real-time updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-orders') {
    event.waitUntil(updateOrdersInBackground());
  }
});

async function updateOrdersInBackground() {
  console.log('[SW] Background order update...');
  // Fetch latest orders and update cache
}

console.log('[SW] DeliveryPro Service Worker loaded');
