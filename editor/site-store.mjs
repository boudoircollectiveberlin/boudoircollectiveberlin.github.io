import { readFile, writeFile, rename, unlink, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readDraftSite, revisionOf, readPublication, publicationFile } from '../shared/site-publication.mjs';
import { sitePages, additionalPages } from '../shared/site-pages.mjs';
import { addTranslationPair } from './local-translations.mjs';
import { requirePermission } from './policy.mjs';
import { validatePageHtml } from './local-editor-core.mjs';

export async function atomicSource(file,source) {
  const directory=path.dirname(file);
  if(path.resolve(await realpath(directory))!==path.resolve(directory))throw Error('Verknüpfter Inhaltsordner ist nicht erlaubt.');
  try { if((await lstat(file)).isSymbolicLink())throw Error('Verknüpfte Inhaltsdatei ist nicht erlaubt.'); }
  catch(error) {if(error.code!=='ENOENT')throw error;}
  const temporary=path.join(directory,'.'+randomUUID()+'.tmp');
  try {await writeFile(temporary,source,{flag:'wx'});await rename(temporary,file);}
  finally {await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
export function assertSiteRevision(root,revision) {
  if(revision!==revisionOf(readDraftSite(root)))throw Object.assign(Error('Der gespeicherte Stand wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Bitte mit dem neuen Stand vergleichen.'),{status:409});
}
export async function publicationAction(root,policy,identity,body) {
  requirePermission(policy,identity,body.action==='review'?'approve':'publish','publications',{id:'site'});
  assertSiteRevision(root,body.revision);
  const state=readPublication(root),snapshot=readDraftSite(root),revision=revisionOf(snapshot);
  if(body.confirm!==true || body.activeRevision!==state.active.revision)throw Object.assign(Error('Bitte den aktuellen Website-Stand ausdrücklich bestätigen.'),{status:409});
  for(const page of snapshot.pages)validatePageHtml(page.html);
  const record={revision,snapshot,actor:identity.id,at:new Date().toISOString()};
  if(body.action==='review')state.reviewed=record;
  else if(body.action==='publish') {
    if(!state.reviewed || state.reviewed.revision!==revision || revisionOf(state.reviewed.snapshot)!==revision)throw Object.assign(Error('Genau dieser gespeicherte Stand muss zuerst geprüft werden.'),{status:409});
    state.previous=state.active;
    state.active=structuredClone(state.reviewed);
  }else if(body.action==='withdraw') {
    if(!state.previous)throw Error('Keine vorherige Website-Freigabe vorhanden.');
    state.active=state.previous;state.previous=null;state.reviewed=null;
  }else throw Error('Unbekannte Freigabeaktion.');
  state.audit.push({action:body.action,revision:state.active.revision,draftRevision:revision,actor:identity.id,at:record.at});
  await atomicSource(publicationFile(root),JSON.stringify(state,null,2)+'\n');
  // Refresh only approved display data. No build/deploy, Git, operational mutation or external API.
  await writeFile(path.join(root,'public/i18n.js'),state.active.snapshot.i18n);
  await writeFile(path.join(root,'public/data/events.json'),JSON.stringify(state.active.snapshot.events,null,2)+'\n');
}
export async function createSitePage(root,policy,identity,body) {
  requirePermission(policy,identity,'create','pages',{id:'new'});
  assertSiteRevision(root,body.revision);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length>60 || !['article','page','journal'].includes(body.type) ||
    !body.values || ['de','en'].some(locale=>typeof body.values[locale]!=='string' || body.values[locale].length>180) || !body.values.de.trim() ||
    !body.summary || ['de','en'].some(locale=>typeof body.summary[locale]!=='string' || body.summary[locale].length>2000) || !body.summary.de.trim())throw Error('Bitte Seitentyp, kurze Adresse, deutschen Titel und Kurzbeschreibung angeben.');
  const id='redaktion-'+body.slug;
  if(sitePages(root).some(page=>page.id===id))throw Error('Diese Seitenadresse existiert bereits.');
  const key='editor_'+id.replaceAll('-','_'),pages=additionalPages(root);
  if(body.type==='journal' && pages.some(page=>page.type==='journal'))throw Error('Eine Journalübersicht ist bereits vorhanden.');
  const page={id,path:id+'.html',title:body.values.de,titleKey:key+'_title',summaryKey:key+'_summary',area:body.type==='page'?'Redaktion':'Journal',type:body.type,navigation:body.navigation===true,ownerId:identity.id};
  const originalI18n=await readFile(path.join(root,'i18n.js'),'utf8');
  let i18n=addTranslationPair(originalI18n,page.titleKey,body.values);
  i18n=addTranslationPair(i18n,page.summaryKey,body.summary);
  const source=await readFile(path.join(root,'src/content/pages/index.html'),'utf8');
  const header=source.slice(0,source.indexOf('<main'));
  const footer=source.slice(source.lastIndexOf('</main>')+7);
  const html=header+`<main><section class="section-band bcb-journal-header"><h1 data-i18n="${page.titleKey}"></h1><p data-i18n="${page.summaryKey}"></p></section>${body.type==='journal'?'<section class="section-band bcb-journal-list" data-bcb-journal-list></section>':''}</main>`+footer;
  validatePageHtml(html);
  const file=path.join(root,'src/content/pages',page.path);
  // Never overwrite an orphaned/unregistered source.
  try {await lstat(file);throw Error('Für diese Adresse liegt bereits eine Inhaltsdatei vor.');}
  catch(error) {if(error.code!=='ENOENT')throw error;}
  try {
    await atomicSource(file,html);
    await atomicSource(path.join(root,'i18n.js'),i18n);
    await atomicSource(path.join(root,'content/site-pages.json'),JSON.stringify([...pages,page],null,2)+'\n');
  }catch(error) {
    await atomicSource(path.join(root,'i18n.js'),originalI18n);
    await unlink(file).catch(problem=>{if(problem.code!=='ENOENT')throw problem;});
    throw error;
  }
  return page;
}

/** Resolve affected resources from trusted stored data, never client roles or ownership. */
export function authorizeMutation(root,policy,identity,route,body) {
  const pages=sitePages(root),page=pages.find(page=>page.id===body.id);
  const draft=readDraftSite(root);
  const check=(action,resource,document)=>requirePermission(policy,identity,action,resource,document);
  if(route==='save') {
    if(!page)throw Error('Unbekannte Seite.');
    if(body.html!==draft.pages.find(item=>item.id===page.id).html)check('update','pages',page);
    for(const [locale,values] of Object.entries(body.translations || {}))for(const key of Object.keys(values))check('update','translations',{id:key,locale});
    for(const update of body.events || []) {
      const event=draft.events.events.find(item=>item.id===update.id);
      if(!event)throw Error('Unbekanntes Event.');
      const field=update.field.startsWith('content.')?event.content?.[update.field.slice(8)]:event[update.field];
      for(const locale of ['de','en'])if(update.values?.[locale]!==field?.[locale])check('update','events',{id:event.id,locale});
      if(update.review)check('approve','events',{id:event.id});
    }
  }else if(route==='navigation-save')check('update','navigation',{id:'site'});
  else if(route==='media-prepare')check('update','media',{id:body.src});
  else if(route==='metadata-save') {
    if(!page)throw Error('Unbekannte Seite.');
    if(page.type==='event') {
      const event=draft.events.events.find(event=>event.detailPage===page.path);
      check('update','events',{id:event?.id,locale:body.locale});
    }else check('update','pages',page);
  }else if(route==='event-save') {
    // The legacy batch endpoint is operator-only: use normal drafts for scoped event edits.
    check('update','navigation',{id:'site'});
  }else if(route==='translation-save')check('update','translations',{id:body.key,locale:body.locale});
  else if(route==='text-create')for(const locale of Object.keys(body.values || {}))check('update','translations',{id:body.key,locale});
  else throw Error('Unbekannte Redaktionsaktion.');
}
