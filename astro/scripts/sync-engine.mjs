#!/usr/bin/env node
/**
 * Synchronise le moteur HOT MOTOR MOTION (source unique : ../index.html,
 * ../js, ../css, ../img, ../icons) vers le projet Astro :
 *
 *   public/assets/motion/**        fichiers servis tels quels
 *   src/generated/editor-shell.html  DOM de l'éditeur, sans les <script>
 *   src/generated/editor-scripts.html ordre de chargement, recopié de index.html
 *
 * Lancé automatiquement par `npm run dev`, `npm run build` et après
 * `npm install`. Rien n'est maintenu à la main dans les deux versions : un
 * fichier oublié ici est un fichier oublié là-bas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const astroRoot = path.resolve(__dirname, '..');
const appRoot = path.resolve(astroRoot, '..');
const publicRoot = path.join(astroRoot, 'public');
const assetsRoot = path.join(publicRoot, 'assets', 'motion');
const ASSET_BASE = '/assets/motion/';

function copyDir(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return true;
}

function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? dirSize(full) : fs.statSync(full).size);
  }, 0);
}

function main() {
  for (const dir of ['js', 'css', 'img', 'icons']) {
    const src = path.join(appRoot, dir);
    if (!fs.existsSync(src)) throw new Error(`Dossier source manquant : ${src}`);
    copyDir(src, path.join(assetsRoot, dir));
  }

  // Petits fichiers servis à la racine du site Astro.
  copyIfExists(path.join(appRoot, 'icons', 'favicon-32.png'), path.join(publicRoot, 'favicon-32.png'));
  copyIfExists(path.join(appRoot, 'icons', 'apple-touch-icon.png'), path.join(publicRoot, 'apple-touch-icon.png'));
  copyIfExists(path.join(appRoot, 'robots.txt'), path.join(publicRoot, 'robots.txt'));

  const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error('index.html : <body> introuvable');

  // Ordre de chargement : celui de index.html, jamais réécrit à la main.
  const scripts = [];
  const scriptRe = /<script\b[^>]*\bsrc\s*=\s*"([^"]+)"[^>]*>\s*<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(bodyMatch[1])) !== null) {
    scripts.push('<script src="' + match[1].replace(/^(js|css|img|icons)\//, ASSET_BASE + '$1/') + '"></script>');
  }
  if (!scripts.length) throw new Error('index.html : aucun <script src> trouvé');

  const body = bodyMatch[1]
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/(src|href)="(js|css|img|icons)\//g, `$1="${ASSET_BASE}$2/`);

  const generated = path.join(astroRoot, 'src', 'generated');
  fs.mkdirSync(generated, { recursive: true });
  fs.writeFileSync(path.join(generated, 'editor-shell.html'), body, 'utf8');
  fs.writeFileSync(path.join(generated, 'editor-scripts.html'), scripts.join('\n') + '\n', 'utf8');

  // Manifeste PWA : mêmes icônes, mais l'entrée est la route /editor.
  const manifestSrc = path.join(appRoot, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestSrc, 'utf8'));
      manifest.start_url = '/editor';
      manifest.scope = '/';
      manifest.id = '/editor';
      manifest.icons = (manifest.icons || []).map((icon) => ({
        ...icon,
        src: ASSET_BASE + String(icon.src).replace(/^\.?\//, '')
      }));
      fs.writeFileSync(path.join(publicRoot, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
    } catch (err) {
      console.warn('[motion-astro] manifeste invalide, ignoré :', err.message);
    }
  }

  const kb = (bytes) => (bytes / 1024).toFixed(0) + ' Ko';
  console.log(`[motion-astro] moteur synchronisé → public/assets/motion/ (${kb(dirSize(path.join(assetsRoot, 'js')))} de JavaScript)`);
  console.log(`[motion-astro] shell éditeur → src/generated/editor-shell.html (${(body.length / 1024).toFixed(1)} Ko)`);
  console.log(`[motion-astro] scripts → src/generated/editor-scripts.html (${scripts.length} fichiers)`);
}

main();
