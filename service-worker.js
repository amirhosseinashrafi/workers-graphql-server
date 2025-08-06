/**
 * Service Worker for Smart Factory Monitoring Dashboard
 * Provides offline functionality and caching strategies
 */

const CACHE_NAME = 'smart-factory-v1.0.0';
const DATA_CACHE_NAME = 'smart-factory-data-v1.0.0';

// Files to cache for offline functionality
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap'
];

// Data files that need special caching strategy
const DATA_FILES = [
    '/data.csv'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (evt) => {
    console.log('[ServiceWorker] نصب در حال انجام...');
    
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] فایل‌های استاتیک کش می‌شوند');
            return cache.addAll(FILES_TO_CACHE);
        }).catch((error) => {
            console.error('[ServiceWorker] خطا در کش کردن فایل‌ها:', error);
        })
    );
    
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (evt) => {
    console.log('[ServiceWorker] فعال‌سازی در حال انجام...');
    
    evt.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                    console.log('[ServiceWorker] حذف کش قدیمی:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    
    // Take control of all pages immediately
    self.clients.claim();
});

/**
 * Fetch event - serve cached content when offline
 */
self.addEventListener('fetch', (evt) => {
    const { request } = evt;
    const url = new URL(request.url);
    
    // Handle data files (CSV) with network-first strategy
    if (DATA_FILES.some(file => url.pathname.includes(file))) {
        evt.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return fetch(request)
                    .then((response) => {
                        // If the request was successful, clone and cache the response
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            cache.put(request, responseClone);
                            console.log('[ServiceWorker] فایل داده بروزرسانی شد:', url.pathname);
                        }
                        return response;
                    })
                    .catch(() => {
                        // If network fails, try to get from cache
                        console.log('[ServiceWorker] شبکه در دسترس نیست، از کش استفاده می‌شود');
                        return cache.match(request);
                    });
            })
        );
        return;
    }
    
    // Handle app shell and static assets with cache-first strategy
    if (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com') {
        evt.respondWith(
            caches.match(request).then((response) => {
                if (response) {
                    // Return cached version
                    return response;
                }
                
                // Fetch from network and cache
                return fetch(request).then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                }).catch(() => {
                    // If both cache and network fail, return offline page
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
            })
        );
    }
});

/**
 * Background sync for data updates
 */
self.addEventListener('sync', (evt) => {
    console.log('[ServiceWorker] همگام‌سازی پس‌زمینه:', evt.tag);
    
    if (evt.tag === 'data-sync') {
        evt.waitUntil(syncData());
    }
});

/**
 * Push notification handling
 */
self.addEventListener('push', (evt) => {
    console.log('[ServiceWorker] اعلان push دریافت شد');
    
    let data = {};
    if (evt.data) {
        data = evt.data.json();
    }
    
    const options = {
        body: data.body || 'بروزرسانی جدید در داشبورد کارخانه هوشمند',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'factory-update',
        data: data,
        actions: [
            {
                action: 'view',
                title: 'مشاهده',
                icon: '/icon-view.png'
            },
            {
                action: 'dismiss',
                title: 'رد کردن',
                icon: '/icon-dismiss.png'
            }
        ],
        vibrate: [200, 100, 200],
        requireInteraction: true
    };
    
    evt.waitUntil(
        self.registration.showNotification(data.title || 'کارخانه هوشمند', options)
    );
});

/**
 * Notification click handling
 */
self.addEventListener('notificationclick', (evt) => {
    console.log('[ServiceWorker] کلیک روی اعلان:', evt.action);
    
    evt.notification.close();
    
    if (evt.action === 'view') {
        evt.waitUntil(
            clients.openWindow('/')
        );
    } else if (evt.action === 'dismiss') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        evt.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

/**
 * Message handling from main app
 */
self.addEventListener('message', (evt) => {
    console.log('[ServiceWorker] پیام دریافت شد:', evt.data);
    
    if (evt.data && evt.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (evt.data && evt.data.type === 'CACHE_DATA') {
        cacheData(evt.data.url, evt.data.data);
    }
    
    // Send response back to client
    evt.ports[0].postMessage({
        type: 'RESPONSE',
        success: true,
        message: 'پیام دریافت شد'
    });
});

/**
 * Sync data function
 */
async function syncData() {
    try {
        console.log('[ServiceWorker] شروع همگام‌سازی داده‌ها...');
        
        // Try to fetch latest data
        const response = await fetch('/data.csv');
        if (response.ok) {
            const cache = await caches.open(DATA_CACHE_NAME);
            await cache.put('/data.csv', response.clone());
            console.log('[ServiceWorker] داده‌ها با موفقیت همگام‌سازی شدند');
            
            // Notify all clients about data update
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'DATA_UPDATED',
                    message: 'داده‌ها بروزرسانی شدند'
                });
            });
        }
    } catch (error) {
        console.error('[ServiceWorker] خطا در همگام‌سازی داده‌ها:', error);
    }
}

/**
 * Cache data manually
 */
async function cacheData(url, data) {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const response = new Response(data, {
            headers: {
                'Content-Type': 'text/csv',
                'Cache-Control': 'max-age=300' // 5 minutes
            }
        });
        await cache.put(url, response);
        console.log('[ServiceWorker] داده به صورت دستی کش شد:', url);
    } catch (error) {
        console.error('[ServiceWorker] خطا در کش کردن داده:', error);
    }
}

/**
 * Periodic background sync (if supported)
 */
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', (evt) => {
        console.log('[ServiceWorker] همگام‌سازی دوره‌ای:', evt.tag);
        
        if (evt.tag === 'data-refresh') {
            evt.waitUntil(syncData());
        }
    });
}

/**
 * Handle app update
 */
self.addEventListener('activate', (evt) => {
    // Check for app updates and notify clients
    evt.waitUntil(
        (async () => {
            if ('navigationPreload' in self.registration) {
                await self.registration.navigationPreload.enable();
            }
            
            // Notify clients about service worker update
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATED',
                    message: 'اپلیکیشن بروزرسانی شد'
                });
            });
        })()
    );
});

/**
 * Handle fetch errors gracefully
 */
function handleFetchError(request) {
    if (request.destination === 'document') {
        return caches.match('/index.html');
    }
    
    if (request.destination === 'image') {
        return new Response(
            '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1a1a2e"/><text x="50%" y="50%" text-anchor="middle" fill="#58a6ff">تصویر در دسترس نیست</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
        );
    }
    
    return new Response('منبع در دسترس نیست', {
        status: 408,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

/**
 * Clean up old data cache entries
 */
async function cleanupDataCache() {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const requests = await cache.keys();
        
        // Keep only the last 10 data entries
        if (requests.length > 10) {
            const oldRequests = requests.slice(0, requests.length - 10);
            await Promise.all(oldRequests.map(request => cache.delete(request)));
            console.log('[ServiceWorker] کش قدیمی داده‌ها پاک شد');
        }
    } catch (error) {
        console.error('[ServiceWorker] خطا در پاک‌سازی کش:', error);
    }
}

// Run cleanup every hour (if the service worker is active)
setInterval(cleanupDataCache, 60 * 60 * 1000);

console.log('[ServiceWorker] سرویس ورکر کارخانه هوشمند آماده است! 🏭');