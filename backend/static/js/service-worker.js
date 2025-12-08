// Service Worker for Emergency Services Locator PWA
// Service workers enable offline functionality and caching for Progressive Web Apps

// Cache version names - increment version to force cache refresh
const CACHE_NAME = 'emergency-services-locator-v1';
const STATIC_CACHE = 'emergency-static-v1'; // Cache for static assets (CSS, JS, images)
const DYNAMIC_CACHE = 'emergency-dynamic-v1'; // Cache for API responses and dynamic content

// List of static assets to cache when service worker installs
// These files are cached immediately for offline access
const STATIC_ASSETS = [
    '/', // Home page
    '/static/css/style.css', // Custom styles
    '/static/js/map.js', // Main JavaScript file
    '/static/icons/icon-192x192.png', // PWA icon
    '/static/icons/icon-512x512.png', // PWA icon
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', // Leaflet map CSS
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css', // Marker cluster CSS
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css', // Cluster default CSS
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' // Font Awesome icons
];

// Service worker install event
// Fires when service worker is first installed or updated
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    // Wait for caching to complete before activating
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            // Cache all static assets
            return cache.addAll(STATIC_ASSETS.map(url => {
                try {
                    // Create request with no-cors mode for cross-origin resources
                    return new Request(url, { mode: 'no-cors' });
                } catch (e) {
                    return url;
                }
            })).catch(err => {
                console.log('[Service Worker] Cache addAll failed:', err);
                // Continue even if some assets fail to cache
                return Promise.resolve();
            });
        })
    );
    // Activate new service worker immediately without waiting for pages to close
    self.skipWaiting();
});

// Service worker activate event
// Fires when service worker becomes active
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        // Get all cache names
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old caches that don't match current version
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all pages immediately
    return self.clients.claim();
});

// Fetch event - intercepts all network requests
// Implements caching strategies for offline support
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests (CDN resources like Leaflet, Font Awesome)
    // Let browser handle these directly
    if (url.origin !== location.origin && !url.href.startsWith('http://localhost')) {
        return;
    }

    // Different caching strategies for different types of requests
    if (request.url.includes('/api/')) {
        // Network First strategy for API calls
        // Try network first, fallback to cache if offline
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone response because it can only be read once
                    const responseToCache = response.clone();
                    // Cache successful API responses for offline access
                    if (response.status === 200) {
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Network request failed, try to serve from cache
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // No cache available, return offline error message
                        return new Response(
                            JSON.stringify({ 
                                error: 'You are offline. Please check your connection.',
                                offline: true 
                            }),
                            {
                                status: 503,
                                headers: { 'Content-Type': 'application/json' }
                            }
                        );
                    });
                })
        );
    } else {
        // Cache First strategy for static assets
        // Check cache first, then network if not found
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version immediately
                    return cachedResponse;
                }
                // Not in cache, fetch from network
                return fetch(request).then((response) => {
                    // Only cache successful responses
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    // Clone response and add to cache for future use
                    const responseToCache = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                    return response;
                }).catch(() => {
                    // Network failed and not in cache
                    // For page navigation requests, return cached home page
                    if (request.mode === 'navigate') {
                        return caches.match('/').then((cachedPage) => {
                            return cachedPage || new Response('Offline', { status: 503 });
                        });
                    }
                });
            })
        );
    }
});

// Background sync event
// Allows syncing data when connection is restored (future feature)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-services') {
        event.waitUntil(
            // Sync logic would go here
            // Example: sync user actions performed while offline
            console.log('[Service Worker] Background sync triggered')
        );
    }
});

// Push notification event
// Handles push notifications from server (future feature)
self.addEventListener('push', (event) => {
    // Notification options
    const options = {
        body: event.data ? event.data.text() : 'New emergency service update',
        icon: '/static/icons/icon-192x192.png', // Notification icon
        badge: '/static/icons/icon-72x72.png', // Small badge icon
        vibrate: [200, 100, 200], // Vibration pattern for mobile
        tag: 'emergency-service-update' // Notification tag
    };
    
    // Show notification to user
    event.waitUntil(
        self.registration.showNotification('Emergency Services Locator', options)
    );
});

