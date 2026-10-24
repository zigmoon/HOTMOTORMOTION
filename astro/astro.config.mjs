import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Version serveur : les routes /api (santé, relais IA) restent dynamiques.
// Pour un hébergement purement statique : passer output à 'static',
// retirer l'adaptateur et supprimer src/pages/api/.
export default defineConfig({
  site: 'https://motion.zig-js.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  trailingSlash: 'ignore',
  compressHTML: true,
  vite: {
    build: {
      // Le moteur est servi tel quel depuis public/assets/motion : il ne doit
      // pas être haché ni inliné, sinon les chemins du shell deviennent faux.
      assetsInlineLimit: 0
    }
  }
});

