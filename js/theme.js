/* ═══════════════════════════════════════════════════════════════════════════
   HOT MOTOR MOTION — thème
   Chargé dans <head>, avant le premier rendu : le document naît dans le bon
   thème, sans flash clair. La bascule interactive vit dans shell.js.
   Sombre par défaut ; clair si l'utilisateur l'a choisi.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    var THEME_KEY = 'hmm:theme';
    var root = document.documentElement;
    var theme = 'dark';

    try {
        var stored = window.localStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') theme = stored;
    } catch (error) {
        /* Stockage indisponible (navigation privée) : on reste en sombre. */
    }

    var isDark = theme !== 'light';

    root.classList.toggle('theme-dark', isDark);
    root.classList.toggle('theme-light', !isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.style.colorScheme = isDark ? 'dark' : 'light';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#121214' : '#f8f8f8');
})();
