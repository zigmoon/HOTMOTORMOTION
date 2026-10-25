#!/usr/bin/env node
/**
 * Contrôles du moteur web, sans aucune dépendance.
 *
 * Lancé par `npm run check` (ou `node scripts/check-web.mjs`) et par la CI.
 * Le but n'est pas de remplacer un navigateur : c'est d'attraper ici les
 * erreurs qui ne se voient qu'à l'exécution, et de faire respecter deux
 * invariants du projet — pas d'identifiant orphelin, pas de preset lourd.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const failures = [];
const notes = [];

const fail = (message) => failures.push(message);
const note = (message) => notes.push(message);

// ── 1. Compilation des scripts ─────────────────────────────────────────────

const scripts = ['js/theme.js', 'js/presets.js', 'js/bundle.js', 'js/shell.js'];

for (const file of scripts) {
  const source = read(file);
  try {
    // `new Function` compile sans exécuter : un `import` ou une accolade
    // manquante est signalé ici plutôt qu'en production.
    new Function(source);
  } catch (error) {
    fail(`${file} : ${error.message}`);
  }
}
note(`${scripts.length} scripts compilés`);

// ── 2. Identifiants : aucun doublon, aucun orphelin ────────────────────────

const html = read('index.html');
const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicated = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);

if (duplicated.length) {
  fail(`index.html : identifiants en double — ${[...new Set(duplicated)].join(', ')}`);
}

const known = new Set(htmlIds);

// Créés dynamiquement par le moteur, donc absents du HTML statique.
const dynamic = new Set([
  'timeline-tracks-inner',
  'timeline-ruler',
  'playhead',
  'btn-add-keyframe',
  'btn-add-keyframe-all',
  'btn-duplicate',
  'shape-easing',
  'preset-panel',
]);

// Présents uniquement dans le document exporté (`generateExportJS`), pas dans
// l'éditeur : ils sont écrits dans une chaîne, pas dans le DOM.
const exported = new Set(['play-btn', 'pause-btn', 'stop-btn']);

for (const file of ['js/bundle.js', 'js/shell.js']) {
  const source = read(file);
  for (const match of source.matchAll(/getElementById\('([^']+)'\)/g)) {
    const id = match[1];
    if (!known.has(id) && !dynamic.has(id) && !exported.has(id)) {
      fail(`${file} référence #${id}, absent de index.html`);
    }
  }
}
note(`${htmlIds.length} identifiants vérifiés`);

// ── 3. Feuille de style ────────────────────────────────────────────────────

const css = read('css/style.css');
const open = (css.match(/\{/g) || []).length;
const close = (css.match(/\}/g) || []).length;
if (open !== close) fail(`css/style.css : ${open} accolades ouvrantes, ${close} fermantes`);

const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]));
for (const variable of used) {
  if (!defined.has(variable)) fail(`css/style.css utilise ${variable}, non défini`);
}
note(`${defined.size} variables CSS définies, ${used.size} utilisées`);

// ── 4. Ressources locales réellement présentes ─────────────────────────────

for (const match of html.matchAll(/(?:src|href)="((?!https?:|data:|#)[^"]+)"/g)) {
  const relative = match[1].split('?')[0];
  if (!relative || relative.endsWith('/')) continue;
  if (!fs.existsSync(path.join(root, relative))) {
    fail(`index.html référence ${relative}, fichier absent`);
  }
}

// ── 5. Bibliothèque de presets : légèreté imposée ──────────────────────────

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('js/presets.js'), sandbox, { filename: 'presets.js' });
const library = sandbox.window.HMMPresets;

if (!library) {
  fail('presets.js : window.HMMPresets absent');
} else {
  const ids = new Set();
  const all = library.categories.flatMap((category) => category.presets);

  for (const preset of all) {
    if (ids.has(preset.id)) fail(`preset en double : ${preset.id}`);
    ids.add(preset.id);
    if (typeof preset.build !== 'function') fail(`preset ${preset.id} sans build()`);
    if (!preset.label || !preset.glyph) fail(`preset ${preset.id} : libellé ou glyphe manquant`);
  }

  // Harnais minimal : on compte ce que chaque preset produit réellement.
  const MAX_SHAPES = 20;
  const MAX_KEYS = 200;

  for (const preset of all) {
    let shapes = 0;
    let keys = 0;

    const harness = {
      duration: 10,
      clear: () => {
        shapes = 0;
        keys = 0;
      },
      shape: (type, properties = {}) => {
        if (!['Rect', 'Circle', 'Text', 'SVG'].includes(type)) {
          throw new Error(`type inconnu ${type}`);
        }
        shapes += 1;
        return { type, x: 400, y: 225, ...properties, keyframes: {} };
      },
      keys: (shape, property, list) => {
        if (!Array.isArray(list) || list.length === 0) {
          throw new Error(`images clés vides sur ${property}`);
        }
        for (const key of list) {
          if (!Number.isFinite(key.t)) throw new Error(`t invalide sur ${property}`);
          if (typeof key.v !== 'number' || !Number.isFinite(key.v)) {
            throw new Error(`v invalide sur ${property}`);
          }
        }
        keys += list.length;
        shape.keyframes[property] = list;
      },
    };

    try {
      preset.build(harness);
    } catch (error) {
      fail(`preset ${preset.id} : ${error.message}`);
      continue;
    }

    if (shapes === 0) fail(`preset ${preset.id} ne dessine rien`);
    if (shapes > MAX_SHAPES) {
      fail(`preset ${preset.id} : ${shapes} formes (maximum ${MAX_SHAPES})`);
    }
    if (keys > MAX_KEYS) {
      fail(`preset ${preset.id} : ${keys} images clés (maximum ${MAX_KEYS})`);
    }
  }

  if (library.scripts.length !== 16) {
    fail(`scripts rapides : ${library.scripts.length} (16 attendus)`);
  }

  note(`${all.length} presets, ${library.scripts.length} scripts rapides, tous sous ${MAX_SHAPES} formes / ${MAX_KEYS} images clés`);
}

// ── 6. Hygiène ─────────────────────────────────────────────────────────────

for (const file of scripts) {
  const source = read(file);
  if (/console\.log\(/.test(source)) fail(`${file} : console.log oublié`);
  if (/\bdebugger\b/.test(source)) fail(`${file} : debugger oublié`);
}

if (!/^<!doctype html>/i.test(html.trim())) fail('index.html : doctype manquant');
if (!/<html[^>]+lang="fr"/.test(html)) fail('index.html : attribut lang manquant');
if (!/class="theme-dark"/.test(html)) fail('index.html : thème sombre par défaut absent');

const brand = html.match(/<a class="brand"[\s\S]*?<\/a>/);
if (brand && /<span/.test(brand[0])) {
  fail('index.html : la marque ne doit pas porter de libellé à côté du logo');
}

// ── 7. Hors ligne : service worker et page de secours ──────────────────────

const sw = read('sw.js');
try {
  new Function(sw);
} catch (error) {
  fail(`sw.js : ${error.message}`);
}

if (!/const VERSION = '[^']+'/.test(sw)) {
  fail('sw.js : constante VERSION absente (le cache ne serait jamais purgé)');
}
if (!sw.includes("'/api/'") && !sw.includes('"/api/"')) {
  fail('sw.js : les routes /api/ ne sont pas exclues du cache');
}
if (!/proxy\\\.php/.test(sw)) {
  fail('sw.js : proxy.php n’est pas exclu du cache');
}
if (!/request\.method !== 'GET'/.test(sw)) {
  fail('sw.js : les requêtes non-GET doivent être ignorées');
}

const precacheBlock = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
if (!precacheBlock) {
  fail('sw.js : tableau PRECACHE introuvable');
} else {
  const precache = [...precacheBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

  if (!precache.length) fail('sw.js : PRECACHE est vide');

  for (const entry of precache) {
    // './' désigne la page d'entrée elle-même.
    const relative = entry === './' ? 'index.html' : entry;
    if (!fs.existsSync(path.join(root, relative))) {
      fail(`sw.js précache ${entry}, fichier absent`);
    }
  }

  if (!precache.includes('offline.html')) {
    fail('sw.js : offline.html doit être précaché (secours des navigations)');
  }
  if (!scripts.every((file) => precache.includes(file))) {
    const missing = scripts.filter((file) => !precache.includes(file));
    fail(`sw.js : scripts non précachés — ${missing.join(', ')}`);
  }
  note(`${precache.length} fichiers précachés, tous présents`);
}

const offline = read('offline.html');
if (!/^<!doctype html>/i.test(offline.trim())) fail('offline.html : doctype manquant');
if (!/<html[^>]+lang="fr"/.test(offline)) fail('offline.html : attribut lang manquant');
for (const match of offline.matchAll(/(?:src|href)="((?!https?:|data:|#|\.\/)[^"]+)"/g)) {
  if (!fs.existsSync(path.join(root, match[1]))) {
    fail(`offline.html référence ${match[1]}, fichier absent`);
  }
}

const shell = read('js/shell.js');
if (!/serviceWorker\.register\('sw\.js'\)/.test(shell)) {
  fail('js/shell.js : le service worker n’est pas enregistré');
}
if (!/sw'\) === 'off'/.test(shell)) {
  fail('js/shell.js : le mode de dépannage ?sw=off a disparu');
}

// ── Rapport ────────────────────────────────────────────────────────────────

for (const line of notes) console.log(`  · ${line}`);

if (failures.length) {
  console.error(`\n${failures.length} problème(s) :`);
  for (const line of failures) console.error(`  ✗ ${line}`);
  process.exit(1);
}

console.log('\nMoteur web : aucun problème détecté.');
