// One-off migration helper: splits the legacy root HTML pages into
// Astro page shells (src/pages) and Git-managed body fragments (src/content/pages).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const pages = ['index', 'account', 'event-grabowsee', 'event-wrodow', 'legal'];
mkdirSync('src/pages', { recursive: true });
mkdirSync('src/content/pages', { recursive: true });
mkdirSync('src/layouts', { recursive: true });

for (const name of pages) {
  const html = readFileSync(`${name}.html`, 'utf8').replace(/\r\n/g, '\n');
  const lang = html.match(/<html lang="([^"]+)"/)[1];
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const extra = head
    .split('\n')
    .filter((l) => l.trim() && !/<meta charset|<meta name="viewport"|rel="stylesheet" href="styles.css"/.test(l))
    .map((l) => l.trim());
  const bodyTag = html.match(/<body([^>]*)>/);
  let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
  body = body.replace(/\s*<script src="(i18n|site-config|script)\.js" defer><\/script>/g, '').trim() + '\n';
  writeFileSync(`src/content/pages/${name}.html`, body);
  const meta = { lang, bodyAttrs: bodyTag[1].trim(), head: extra };
  writeFileSync(
    `src/pages/${name}.astro`,
    `---
import Layout from '../layouts/Layout.astro';
import body from '../content/pages/${name}.html?raw';
const meta = ${JSON.stringify(meta, null, 2)};
---
<Layout {...meta}><Fragment set:html={body} /></Layout>
`,
  );
}
