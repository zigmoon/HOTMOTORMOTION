/* ═══════════════════════════════════════════════════════════════════════════
   HOT MOTOR MOTION — coque de l'interface
   Thème (sombre par défaut), panneaux latéraux, état des outils et écran de
   démarrage. Le moteur de l'éditeur reste dans bundle.js.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    var THEME_KEY = 'hmm:theme';
    var PANELS_KEY = 'hmm:panels';

    var root = document.documentElement;
    var app = document.getElementById('app');

    function readStored(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function storeValue(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            /* Navigation privée : la préférence ne survivra pas au rechargement. */
        }
    }

    /* ── Thème ─────────────────────────────────────────────────────────── */

    var themeButton = document.getElementById('btn-theme');

    function currentTheme() {
        return root.dataset.theme === 'light' ? 'light' : 'dark';
    }

    function applyTheme(theme, persist) {
        var isDark = theme !== 'light';

        root.classList.toggle('theme-dark', isDark);
        root.classList.toggle('theme-light', !isDark);
        root.dataset.theme = isDark ? 'dark' : 'light';

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', isDark ? '#121214' : '#f8f8f8');
        }

        if (themeButton) {
            themeButton.setAttribute('aria-pressed', String(!isDark));
            themeButton.title = isDark ? 'Passer au thème clair' : 'Passer au thème sombre';
        }

        if (persist) {
            storeValue(THEME_KEY, isDark ? 'dark' : 'light');
        }
    }

    if (themeButton) {
        themeButton.addEventListener('click', function () {
            applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
        });
    }

    /* Le thème mémorisé a déjà été appliqué dans <head> ; on resynchronise
       seulement l'état des contrôles. Le sombre reste la valeur par défaut. */
    applyTheme(currentTheme(), false);

    /* ── Panneaux latéraux ─────────────────────────────────────────────── */

    function setPanel(side, hidden, persist) {
        if (!app) return;

        app.classList.toggle('hide-' + side, hidden);

        var button = document.getElementById('btn-toggle-' + side);
        if (button) {
            button.setAttribute('aria-pressed', String(!hidden));
        }

        if (persist) {
            var state = {
                left: app.classList.contains('hide-left'),
                right: app.classList.contains('hide-right')
            };
            storeValue(PANELS_KEY, JSON.stringify(state));
        }
    }

    (function restorePanels() {
        var raw = readStored(PANELS_KEY);
        if (raw) {
            try {
                var state = JSON.parse(raw);
                setPanel('left', !!state.left, false);
                setPanel('right', !!state.right, false);
                return;
            } catch (error) {
                /* préférence illisible : on retombe sur la disposition auto */
            }
        }

        // Premier lancement : on dégage de la place à la scène sur les écrans
        // étroits, sans empêcher de rouvrir les panneaux à la main.
        if (window.innerWidth <= 1100) setPanel('right', true, false);
        if (window.innerWidth <= 860) setPanel('left', true, false);
    })();

    ['left', 'right'].forEach(function (side) {
        var button = document.getElementById('btn-toggle-' + side);
        if (!button) return;

        var initiallyHidden = app ? app.classList.contains('hide-' + side) : false;
        button.setAttribute('aria-pressed', String(!initiallyHidden));

        button.addEventListener('click', function () {
            var hidden = app ? !app.classList.contains('hide-' + side) : false;
            setPanel(side, hidden, true);
        });
    });

    /* ── Outils ────────────────────────────────────────────────────────── */

    var selectButton = document.getElementById('btn-select');
    var creationButtons = ['btn-rect', 'btn-circle', 'btn-text'].map(function (id) {
        return document.getElementById(id);
    }).filter(Boolean);

    function activateSelect() {
        if (selectButton) selectButton.classList.add('active');
    }

    if (selectButton) {
        selectButton.addEventListener('click', activateSelect);
    }

    creationButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            /* Créer une forme ramène l'outil Sélection, comme dans SuperPhoto. */
            window.setTimeout(activateSelect, 0);
        });
    });

    /* ── Écran de démarrage ────────────────────────────────────────────── */

    (function initSplash() {
        var splash = document.getElementById('splashScreen');
        if (!splash) return;

        var hidden = false;

        function hideSplash() {
            if (hidden) return;
            hidden = true;
            splash.classList.add('hidden');
            splash.setAttribute('aria-hidden', 'true');
        }

        splash.addEventListener('click', hideSplash);

        if (document.readyState === 'complete') {
            window.setTimeout(hideSplash, 1200);
        } else {
            window.addEventListener('load', function () {
                window.setTimeout(hideSplash, 1200);
            });
        }

        window.setTimeout(hideSplash, 9000);
    })();

    /* ── Cadrage initial ───────────────────────────────────────────────── */

    function fitCanvasIfNeeded() {
        var editor = window.editor;
        var stage = document.querySelector('.canvas-area');
        if (!editor || !stage) return;

        var available = stage.clientWidth - 56;
        var canvasWidth = editor.canvas.getBoundingClientRect().width;

        if (canvasWidth > available) {
            editor.zoomFit();
        }
    }

    function scheduleFit() {
        // Laisse la grille se stabiliser (polices, panneaux restaurés).
        window.setTimeout(fitCanvasIfNeeded, 80);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleFit);
    } else {
        scheduleFit();
    }
    window.addEventListener('load', scheduleFit);

    /* ── Raccourcis de coque ───────────────────────────────────────────── */

    function isEditable(target) {
        if (!target) return false;
        if (target.isContentEditable) return true;
        return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '');
    }

    document.addEventListener('keydown', function (event) {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        if (isEditable(event.target)) return;

        var key = event.key.toLowerCase();

        if (key === 'v') {
            activateSelect();
            return;
        }

        var toolId = { r: 'btn-rect', c: 'btn-circle', t: 'btn-text' }[key];
        if (toolId) {
            var button = document.getElementById(toolId);
            if (button) {
                event.preventDefault();
                button.click();
            }
            return;
        }

        if (event.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(function (modal) {
                modal.classList.add('hidden');
            });
        }
    });

    /* ── Service worker ──────────────────────────────────────────────────
       Hors ligne : le moteur est précaché par sw.js. L'enregistrement exige
       un contexte sécurisé et un vrai serveur ; en file:// il n'y a rien à
       faire. `?sw=off` désinscrit et purge les caches, pour le dépannage.  */

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        var secure = location.protocol === 'https:' ||
            location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.hostname === '[::1]';
        if (!secure) return;

        var optOut = false;
        try {
            optOut = new URLSearchParams(location.search).get('sw') === 'off';
        } catch (error) {
            optOut = false;
        }

        if (optOut) {
            // La page reste contrôlée par l'ancien worker jusqu'au rechargement :
            // sans ce rechargement, il repeuple le cache aussitôt purgé.
            var wasControlled = !!navigator.serviceWorker.controller;

            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                registrations.forEach(function (registration) {
                    registration.unregister();
                });
            }).catch(function () { /* rien à faire */ });

            if (window.caches) {
                window.caches.keys().then(function (keys) {
                    keys.forEach(function (key) {
                        window.caches.delete(key);
                    });
                }).catch(function () { /* rien à faire */ });
            }

            if (wasControlled) {
                window.setTimeout(function () {
                    location.reload();
                }, 200);
            }
            return;
        }

        navigator.serviceWorker.register('sw.js').then(function () {
            // Le navigateur peut réutiliser un worker déjà installé sans
            // rejouer install : on lui demande de vérifier son précache.
            navigator.serviceWorker.ready.then(function (registration) {
                if (registration.active) registration.active.postMessage({ type: 'REPAIR' });
            });
        }).catch(function () {
            /* Refusé (iframe, en-têtes, navigation privée) : l'application
               fonctionne exactement comme avant. */
        });
    }

    registerServiceWorker();
})();
