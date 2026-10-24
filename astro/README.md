# HOT MOTOR MOTION — version Astro

Version **Astro 7** de l’éditeur motion design : page d’accueil, route `/editor`
avec le moteur complet, routes API, sitemap et PWA.

## Principe

Une seule source pour le moteur : `../index.html`, `../js`, `../css`, `../img`,
`../icons`. Aucun fichier n’est recopié à la main.

`scripts/sync-engine.mjs` :

1. copie le moteur dans `public/assets/motion/` ;
2. extrait le DOM de l’éditeur dans `src/generated/editor-shell.html`
   (sans les `<script>`, chargés séparément par `editor.astro`) ;
3. recopie la liste et l’ordre des `<script src>` de `index.html` dans
   `src/generated/editor-scripts.html` — c’est exactement là qu’un fichier
   s’oublie quand on maintient deux listes ;
4. réécrit les chemins relatifs (`js/`, `css/`, `img/`, `icons/`) vers
   `/assets/motion/…` ;
5. adapte le manifeste PWA pour que l’entrée soit `/editor`.

Le script est lancé automatiquement par `postinstall`, `dev` et `build`.
Après une modification de `index.html` ou d’un fichier du moteur, relancez
`npm run sync` (ou `npm run dev`).

## Démarrage

```bash
cd astro
npm install
npm run dev        # http://localhost:4321
```

## Production

```bash
npm ci             # installe exactement package-lock.json
npm run build
npm start          # serveur Node autonome (dist/server/entry.mjs)
```

Le build sort en mode `server` (adaptateur `@astrojs/node`) : `dist/client`
contient les fichiers statiques et `dist/server/entry.mjs` le serveur. Le
build complet est rejoué par la CI (job *Build Astro*), qui démarre aussi le
serveur et interroge `/`, `/editor`, `/api/health`, `/sitemap.xml` et le
moteur. `PORT` et `HOST` sont lus par `npm start`.

Variables d’environnement — toutes **facultatives** : sans elles, le client
envoie sa propre clé dans l’en-tête `x-provider-key`.

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | relais `/api/ai` vers OpenAI |
| `ANTHROPIC_API_KEY` | relais vers Anthropic |
| `GEMINI_API_KEY` | relais vers Google Gemini |
| `XAI_API_KEY` | relais vers xAI |
| `MISTRAL_API_KEY` | relais vers Mistral |
| `COHERE_API_KEY` | relais vers Cohere |
| `PORT` / `HOST` | port et interface du serveur Node |

## Routes

| Route | Description |
|---|---|
| `/` | page d’accueil |
| `/editor` | éditeur complet (moteur synchronisé) |
| `/api/health` | état du service |
| `/api/ai` | relais vers les API d’IA (hôtes en liste blanche) |
| `/sitemap.xml` | sitemap |

## Notes

- `output: 'server'` parce que les routes API sont dynamiques. Pour un site
  100 % statique : `output: 'static'`, retirer l’adaptateur et `src/pages/api/`.
- Le relais `/api/ai` n’accepte que six hôtes HTTPS connus et ne transmet que
  trois en-têtes : sans cette liste blanche, il devient un proxy ouvert (SSRF).
- `public/assets/motion/` et `src/generated/` sont ignorés par Git : ce sont des
  copies, régénérées à chaque build.
