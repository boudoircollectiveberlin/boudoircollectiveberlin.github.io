import { defineConfig } from 'astro/config';
import localEditor from './editor/local-editor.mjs';

export default defineConfig({
  output: 'static',
  site: 'https://www.boudoircollectiveberlin.de',
  build: { format: 'file' },
  publicDir: './public',
  integrations: [localEditor()],
});
