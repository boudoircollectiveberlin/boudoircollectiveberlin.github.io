import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sitePages } from './site-pages.mjs';
import { publicEventCatalog, escapeEventHtml } from './event-content.mjs';
import { readTranslations } from '../editor/local-translations.mjs';
import { renderJournalList } from './journal.mjs';
import { revisionOf, readPublication } from './publication-state.mjs';
export { revisionOf, readPublication, publicationFile } from './publication-state.mjs';

export function readDraftSite(root) {
  const i18n=readFileSync(path.join(root,'i18n.js'),'utf8'),translations=readTranslations(i18n);
  const pages=sitePages(root).map(page=>{
    let meta;
    if(page.titleKey) {
      meta={lang:'de',bodyAttrs:'',head:[`<title>${escapeEventHtml(translations.de[page.titleKey] || page.title)}</title>`,`<meta name="description" content="${escapeEventHtml(translations.de[page.summaryKey] || '')}">`]};
    }else {
      const source=readFileSync(path.join(root,'src/pages',page.id+'.astro'),'utf8');
      meta=JSON.parse(/const meta = (\{[\s\S]*?\n\});/.exec(source)[1]);
    }
    const {ownerId,...publicPage}=page;
    return {...publicPage,title:translations.de[page.titleKey] || page.title,html:readFileSync(path.join(root,'src/content/pages',page.path),'utf8'),meta};
  });
  return {pages,i18n,events:publicEventCatalog(JSON.parse(readFileSync(path.join(root,'data/events.json'),'utf8')))};
}
export function publicationStatus(root) {
  const state=readPublication(root),draft=readDraftSite(root),revision=revisionOf(draft);
  return {revision,activeRevision:state.active.revision,reviewedRevision:state.reviewed?.revision || null,canWithdraw:Boolean(state.previous),changed:revision!==state.active.revision,
    changes:draft.pages.filter(page=>revisionOf(page)!==revisionOf(state.active.snapshot.pages.find(item=>item.id===page.id) || null)).map(page=>({id:page.id,title:page.title})),
    translationsChanged:draft.i18n!==state.active.snapshot.i18n,eventsChanged:revisionOf(draft.events)!==revisionOf(state.active.snapshot.events)};
}
export function composeSitePage(snapshot,id,locale='de') {
  const page=snapshot.pages.find(page=>page.id===id);
  if(!page)return null;
  const text=readTranslations(snapshot.i18n),get=key=>text[locale]?.[key]?.trim() || text.de[key] || text.en[key] || '';
  const articles=snapshot.pages.filter(item=>item.type==='article');
  const extra=snapshot.pages.filter(item=>item.titleKey && item.navigation && (item.type!=='journal' || articles.length));
  const links=extra.map(item=>`<a href="${item.path}" data-i18n="${item.titleKey}">${escapeEventHtml(get(item.titleKey))}</a>`).join('');
  let html=page.html.replace(/(<nav\b[^>]*id="primary-nav"[^>]*>)([\s\S]*?)(<\/nav>)/i,(_,open,content,close)=>open+content+links+close);
  html=html.replace(/(<section\b[^>]*data-bcb-journal-list[^>]*>)[\s\S]*?(<\/section>)/gi,(_,open,close)=>open+renderJournalList(snapshot.pages,text,{locale})+close);
  if(id==='index' && articles.length) {
    const teasers=articles.map(item=>`<article><h3><a href="${item.path}" data-i18n="${item.titleKey}">${escapeEventHtml(get(item.titleKey))}</a></h3><p data-i18n="${item.summaryKey}">${escapeEventHtml(get(item.summaryKey))}</p></article>`).join('');
    html=html.replace('</main>',`<section class="section-band bcb-editorial-teasers" aria-label="Redaktion">${teasers}</section></main>`);
  }
  return {...page,html};
}
