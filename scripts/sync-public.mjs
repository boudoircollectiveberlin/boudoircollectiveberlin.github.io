// Mirrors shared static files into public/ (git-ignored) so Astro serves them
// from the site root without duplicating ~50 MB of assets in Git.
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('public', { recursive: true, force: true });
mkdirSync('public', { recursive: true });
for (const f of ['styles.css', 'script.js', 'i18n.js', 'site-config.js', 'CNAME']) cpSync(f, `public/${f}`);
cpSync('assets', 'public/assets', { recursive: true });
cpSync('data', 'public/data', { recursive: true });
mkdirSync('public/shared', { recursive: true });
cpSync('shared/event-content.mjs', 'public/shared/event-content.mjs');
