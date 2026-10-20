// Mirrors shared static files into public/ (git-ignored) so Astro serves them
// from the site root without duplicating ~50 MB of assets in Git.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readPublication } from '../shared/site-publication.mjs';

rmSync('public', { recursive: true, force: true });
mkdirSync('public', { recursive: true });
for (const f of ['styles.css', 'script.js', 'i18n.js', 'site-config.js', 'CNAME']) cpSync(f, `public/${f}`);
cpSync('assets', 'public/assets', { recursive: true });
cpSync('data', 'public/data', { recursive: true });
mkdirSync('public/shared', { recursive: true });
cpSync('shared/event-content.mjs', 'public/shared/event-content.mjs');
const published=readPublication(process.cwd()).active.snapshot;
writeFileSync('public/i18n.js',published.i18n);
writeFileSync('public/data/events.json',JSON.stringify(published.events,null,2)+'\n');
