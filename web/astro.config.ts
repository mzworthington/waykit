import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { kitPages } from './src/integrations/kitPages';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.resolve(webRoot, '..');


export default defineConfig({
  site: 'https://waykit.dev',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react(), kitPages(kitRoot)],
  vite: {
    envPrefix: ['VITE_', 'POSTHOG_TOKEN', 'POSTHOG_HOST'],
    resolve: {
      alias: {
        '@kit': kitRoot,
        d3: path.join(webRoot, 'node_modules/d3')
      }
    },
    server: {
      fs: {
        allow: [webRoot, kitRoot]
      }
    }
  }
});
