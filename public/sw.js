// Service Worker para PWA FutBeer
const CACHE_NAME = 'futbeer-v1.0.3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/soccer_ball.png',
  '/images/android/ic_launcher-web.png'
];

// Instalar o service worker e fazer cache dos recursos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.error('[SW] Cache failed:', err);
      })
  );
  self.skipWaiting();
});

// Ativar o service worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estratégia: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  // Ignorar requests que não são GET ou que são para extensões de browser
  if (event.request.method !== 'GET' || 
      event.request.url.includes('chrome-extension://') ||
      event.request.url.includes('moz-extension://')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, clonar e guardar em cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), tentar retornar do cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              console.log('[SW] Serving from cache:', event.request.url);
              return response;
            }
            
            // Se não estiver em cache e for navegação, retornar index.html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // Caso contrário, retornar resposta vazia
            return new Response('Offline - Recurso não disponível', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Sincronização em background (para futuras funcionalidades)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Placeholder para sincronização futura
  console.log('[SW] Syncing data...');
}

// Notificações push (para futuras funcionalidades)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Tens novidades no FutBeer!',
  icon: '/images/android/ic_launcher-web.png',
  badge: '/images/android/mipmap-mdpi/ic_launcher.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'FutBeer', options)
  );
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});
