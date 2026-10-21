import { parse } from '@babel/parser';
import { readTranslations } from './local-translations.mjs';
import { validatePageHtml } from './local-editor-core.mjs';
import { allowed } from './policy.mjs';
import { safeEventRichText } from '../shared/event-content.mjs';

function strictDictionary(source) {
  const ast=parse(source,{sourceType:'script'});
  const declaration=ast.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).find(node=>node.id.name==='translations');
  const object=declaration?.init;
  const name=node=>node?.type==='Identifier'?node.name:node?.type==='StringLiteral'?node.value:null;
  const properties=value=>{
    if(value?.type!=='ObjectExpression')throw Error('Ungültiges Sprachobjekt.');
    const seen=new Set();
    for(const entry of value.properties){const key=name(entry.key);if(entry.type!=='ObjectProperty' || entry.computed || entry.shorthand || !key || key==='__proto__' || seen.has(key))throw Error('Sprachdatei enthält aktive oder doppelte Eigenschaften.');seen.add(key);}
    return value.properties;
  };
  const locales=properties(object);
  if(locales.length!==2 || locales.some(entry=>!['de','en'].includes(name(entry.key))))throw Error('Nur DE/EN sind erlaubt.');
  for(const locale of locales)for(const entry of properties(locale.value))if(entry.value.type!=='StringLiteral')throw Error('Sprachwerte müssen reine Texte sein.');
  return {translations:readTranslations(source),shell:source.slice(0,object.start)+'{}'+source.slice(object.end)};
}
function registry(source) {
  const pages=JSON.parse(source);
  if(!Array.isArray(pages) || pages.length>500)throw Error('Ungültiges Seitenregister.');
  const seen=new Set();
  for(const page of pages){if(!/^redaktion-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.id) || page.path!==page.id+'.html' || seen.has(page.id) || !['page','article','journal'].includes(page.type) || !/^editor_[a-z0-9_]+$/.test(page.titleKey) || !/^editor_[a-z0-9_]+$/.test(page.summaryKey) || typeof page.ownerId!=='string')throw Error('Ungültige Seite.');seen.add(page.id);}
  return pages;
}
/** Candidate is only text from Git blobs. Never import/run candidate scripts or workflows. */
export function validateContribution({policy,identity,changes,basePages,candidatePages,baseI18n,candidateI18n,baseHtml,candidateHtml}) {
  if(!identity?.id || !Array.isArray(identity.roles) || !changes.length)throw Error('Identität oder Beitragsänderungen fehlen.');
  const before=registry(basePages),after=registry(candidatePages);
  const permit=(action,resource,document)=>{if(!allowed(policy,identity,action,resource,document))throw Error(`Keine Berechtigung: ${resource}/${document.id} (${action}).`);};
  for(const change of changes)if(!['A','M'].includes(change.status) || !['100644'].includes(change.mode) || !(change.path==='i18n.js' || change.path==='content/site-pages.json' || /^src\/content\/pages\/redaktion-[a-z0-9-]+\.html$/.test(change.path)))throw Error(`Unzulässiger Beitragspfad oder Dateimodus: ${change.path}`);
  for(const original of before){const proposed=after.find(page=>page.id===original.id);if(!proposed || JSON.stringify(original)!==JSON.stringify(proposed))throw Error('Bestehende Seiteneigenschaften, Eigentümer und Navigation dürfen nicht geändert werden.');}
  for(const page of after.filter(page=>!before.some(original=>original.id===page.id))){
    if(page.type!=='article' || page.navigation!==false || page.area!=='Journal' || page.ownerId!==identity.id)throw Error('Neue Artikel benötigen den bestätigten Autor und dürfen die Navigation nicht ändern.');
    permit('create','pages',page);
    if(typeof candidateHtml[page.id]!=='string')throw Error('Artikelinhalt fehlt.');
  }
  for(const change of changes.filter(change=>change.path.startsWith('src/content/pages/'))){
    const id=change.path.split('/').pop().slice(0,-5),page=after.find(page=>page.id===id);
    if(!page)throw Error('Seite fehlt im Register.');
    permit(before.some(item=>item.id===id)?'update':'create','pages',page);validatePageHtml(candidateHtml[id]);
  }
  const old=strictDictionary(baseI18n),next=strictDictionary(candidateI18n);
  if(old.shell!==next.shell)throw Error('JavaScript außerhalb der Sprachtexte wurde geändert.');
  for(const locale of ['de','en'])for(const key of new Set([...Object.keys(old.translations[locale]),...Object.keys(next.translations[locale])])) {
    if(old.translations[locale][key]===next.translations[locale][key])continue;
    if(!(key in next.translations[locale]) || key==='htmlLang')throw Error('Sprachschlüssel dürfen nicht gelöscht werden.');
    safeEventRichText(next.translations[locale][key]);
    const references=[...new Map([...before,...after].map(page=>[page.id,page])).values()].filter(page=>[baseHtml[page.id],candidateHtml[page.id]].some(html=>html?.includes(`="${key}"`) || html?.includes(`:${key}`)));
    // Include fixed site fragments as well, protecting global navigation and shared messages.
    for(const [id,html] of Object.entries(baseHtml))if(!references.some(page=>page.id===id) && (html.includes(`="${key}"`) || html.includes(`:${key}`)))references.push({id});
    if(!references.length)throw Error(`Nicht zugeordneter Sprachschlüssel: ${key}`);
    for(const page of references)permit('update','translations',{...page,locale});
  }
  return {ok:true,files:changes.length,actor:identity.id};
}
