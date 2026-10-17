import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pages = ['index', 'account', 'event-grabowsee', 'event-wrodow', 'legal'];
const hooks = (html) =>
  [...html
    .replace(/<article\b[^>]*data-event-card="[^"]*"[\s\S]*?<\/article>/g,'')
    .replace(/<script\b[^>]*id="bcb-event-catalog"[\s\S]*?<\/script>/g,'')
    .matchAll(/\b(data-i18n[\w-]*="[^"]*"|id="[^"]*"|href="[^"]*"|src="[^"]*")/g)].map((m) => m[1]).sort();

test('Astro build keeps i18n hooks, ids, links and scripts of every page', { skip: !existsSync('dist/index.html') && 'run npm run build first' }, () => {
  for (const page of pages) {
    const legacy = readFileSync(`${page}.html`, 'utf8');
    const built = readFileSync(`dist/${page}.html`, 'utf8');
    assert.deepEqual(hooks(built), hooks(legacy), page);
  }
});
