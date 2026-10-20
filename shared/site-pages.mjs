import { readFileSync } from 'node:fs';
import path from 'node:path';

export const basePages = Object.freeze([
  { id:'index', title:'Startseite', path:'index.html', area:'Website', type:'home' },
  { id:'account', title:'Account', path:'account.html', area:'Community', type:'system' },
  { id:'event-grabowsee', title:'Event: Grabowsee', path:'event-grabowsee.html', area:'Events', type:'event' },
  { id:'event-wrodow', title:'Event: Wrodow', path:'event-wrodow.html', area:'Events', type:'event' },
  { id:'legal', title:'Rechtliches', path:'legal.html', area:'Website', type:'system' },
]);
export function additionalPages(root) {
  const pages=JSON.parse(readFileSync(path.join(root,'content/site-pages.json'),'utf8'));
  if(!Array.isArray(pages) || pages.length>500)throw Error('Ungültiges Seitenverzeichnis.');
  const ids=new Set(basePages.map(page=>page.id));
  for(const page of pages) {
    if(!/^redaktion-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.id) || page.path!==page.id+'.html' || ids.has(page.id) ||
      !['article','page','journal'].includes(page.type) || typeof page.title!=='string' || !/^editor_[a-z0-9_]+$/.test(page.titleKey) ||
      !/^editor_[a-z0-9_]+$/.test(page.summaryKey) || typeof page.navigation!=='boolean' || typeof page.ownerId!=='string')throw Error('Ungültige Redaktionsseite.');
    ids.add(page.id);
  }
  return pages;
}
export const sitePages = root => [...basePages,...additionalPages(root)];
