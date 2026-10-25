/* ═══════════════════════════════════════════════════════════════════════════
   HOT MOTOR MOTION — service worker

   Deux stratégies, choisies à partir de `request.destination` :

   · document (navigation) → réseau d'abord, cache en secours. Une page doit
     être fraîche ; hors ligne, la copie connue prend le relais, et une
     navigation sans copie affiche offline.html. Le réseau n'a que 700 ms
     quand une copie existe : un portail captif ne doit pas bloquer la page.

   · tout le reste (script, style, image, police, manifeste) → cache d'abord,
     réseau en arrière-plan (stale-while-revalidate). Démarrage instantané,
     mise à jour silencieuse pour la visite suivante.

   Ne sont jamais interceptés : les requêtes non-GET, les autres origines
   (API d'IA appelée directement, CDN), `/api/`, `proxy.php` et les requêtes
   `Range` (médias, gros fichiers).

   Ce fichier est la seule source : astro/scripts/sync-engine.mjs en génère une
   copie dont les chemins pointent vers /assets/motion/, /editor et le
   manifeste du site.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// Incrémenter à chaque déploiement : les caches d'une autre version sont
// supprimés à l'activation.
const VERSION = 'hmm-v1';
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = VERSION + '-assets';

// Précache : de quoi ouvrir l'éditeur sans réseau. Un fichier manquant
// n'empêche pas l'installation (voir install), et scripts/check-web.mjs
// vérifie que chaque entrée existe réellement sur le disque.
const PRECACHE = [
  './',
  'offline.html',
  'manifest.json',
  'css/style.css',
  'js/theme.js',
  'js/presets.js',
  'js/bundle.js',
  'js/shell.js',
  'img/HOT_MOTOR_MOTION_b.png',
  'img/HOT_MOTOR_MOTION_b.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Seule la page doit être fraîche à chaque visite : c'est elle qui décide de
// tout le reste. Les scripts et les styles sont servis depuis le cache et
// rafraîchis en arrière-plan — un déploiement se voit donc immédiatement
// (HTML neuf) et le code suit à la visite suivante. Pour que le code soit
// frais *tout de suite*, incrémenter VERSION : le précache est alors rechargé
// avec `cache: 'reload'` avant que le nouveau worker prenne la main.
const FRESH_DESTINATIONS = ['document', 'worker', 'sharedworker'];

// Au-delà de ces délais, un réseau qui ne répond pas est traité comme absent.
// Une copie en cache est disponible : le réseau a peu de temps pour faire
// mieux. Aucune copie : on attend plus longtemps, mais pas indéfiniment.
const CACHED_TIMEOUT = 700;
const NETWORK_TIMEOUT = 8000;

const OFFLINE_URL = new URL('offline.html', self.location.href).href;

/* ── Précache ──────────────────────────────────────────────────────────────
   Chaque entrée est demandée avec `cache: 'reload'` pour ne pas installer un
   fichier périmé sorti du cache HTTP. Les échecs sont tolérés : mieux vaut un
   service worker partiel qu'un service worker absent. Le précache est aussi
   rejoué à l'activation et sur demande (voir REPAIR) : un cache vidé par un
   dépannage ou une éviction du navigateur est reconstruit au lieu de laisser
   un service worker actif mais vide.                                          */

async function precache() {
  const cache = await caches.open(SHELL_CACHE);

  await Promise.all(
    PRECACHE.map(function (url) {
      return fetch(new Request(url, { cache: 'reload' }))
        .then(function (response) {
          if (response && response.ok) return cache.put(url, response);
          return null;
        })
        .catch(function () {
          return null;
        });
    })
  );

  return cache;
}

async function cleanup() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(function (key) {
        return key !== SHELL_CACHE && key !== ASSET_CACHE;
      })
      .map(function (key) {
        return caches.delete(key);
      })
  );
}

async function repair() {
  await cleanup();

  const cache = await caches.open(SHELL_CACHE);
  const known = await cache.keys();
  if (known.length < PRECACHE.length) await precache();
}

self.addEventListener('install', function (event) {
  event.waitUntil(precache());
});

/* ── Activation ────────────────────────────────────────────────────────────
   On supprime les caches d'une autre version, on vérifie que le précache est
   complet, puis on prend la main sur les pages déjà ouvertes.                 */

self.addEventListener('activate', function (event) {
  event.waitUntil(
    repair().then(function () {
      return self.clients.claim();
    })
  );
});

/* ── Prédicats ───────────────────────────────────────────────────────────── */

function isInterceptable(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('range')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf('/api/') !== -1) return false;
  if (/proxy\.php$/.test(url.pathname)) return false;
  return true;
}

function wantsFreshCopy(request) {
  if (request.mode === 'navigate') return true;
  return FRESH_DESTINATIONS.indexOf(request.destination) !== -1;
}

/* ── Stratégies ──────────────────────────────────────────────────────────── */

function withTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise(function (resolve) {
      setTimeout(function () {
        resolve(null);
      }, milliseconds);
    })
  ]);
}

// Réseau puis cache. Quand une copie existe déjà, le réseau n'a que
// CACHED_TIMEOUT pour faire mieux : un portail captif ou un réseau qui ne
// répond plus ne doit pas retarder une page qu'on sait déjà servir.
async function networkThenCache(request) {
  const cacheName = request.mode === 'navigate' ? SHELL_CACHE : ASSET_CACHE;

  const network = fetch(request)
    .then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        caches.open(cacheName).then(function (cache) {
          cache.put(request, response.clone());
        });
      }
      return response;
    })
    .catch(function () {
      return null;
    });

  const cached = await caches.match(request, { ignoreSearch: true });
  const response = await withTimeout(network, cached ? CACHED_TIMEOUT : NETWORK_TIMEOUT);

  if (response) return response;
  if (cached) return cached;

  if (request.mode === 'navigate') {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
  }

  return new Response('', { status: 503, statusText: 'Hors ligne' });
}

// Cache puis réseau, avec rafraîchissement silencieux pour la visite suivante.
// La recherche porte sur tous les caches : les images du précache vivent dans
// SHELL_CACHE, celles vues ensuite dans ASSET_CACHE.
async function cacheThenNetwork(request) {
  const cached = await caches.match(request);

  const cache = await caches.open(ASSET_CACHE);
  const network = fetch(request)
    .then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(function () {
      return null;
    });

  if (cached) {
    network.catch(function () {
      return null;
    });
    return cached;
  }

  const fresh = await withTimeout(network, NETWORK_TIMEOUT);
  if (fresh) return fresh;
  return new Response('', { status: 504, statusText: 'Hors ligne' });
}

self.addEventListener('fetch', function (event) {
  const request = event.request;

  // Correctif connu de Chromium : `only-if-cached` n'est valide qu'en
  // same-origin, sinon la requête lève.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  if (!isInterceptable(request)) return;

  event.respondWith(
    wantsFreshCopy(request) ? networkThenCache(request) : cacheThenNetwork(request)
  );
});

/* ── Messages ──────────────────────────────────────────────────────────────
   `shell.js` s'en sert pour trois choses : forcer l'activation d'une mise à
   jour, reconstruire un précache vidé, purger (dépannage, via ?sw=off).      */

self.addEventListener('message', function (event) {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'REPAIR') {
    event.waitUntil(repair());
    return;
  }

  if (data.type === 'PURGE') {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return caches.delete(key);
          })
        );
      })
    );
  }
});
