import { eventForPage, eventText } from '../shared/event-content.mjs';
import { replaceNavigationLink } from './navigation.mjs';
import { readMetadata, replaceMetadata } from './metadata.mjs';
import { updateEventField, applyEventDrafts, writeEventSource } from './events.mjs';
import { prepareMedia } from './media.mjs';
import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { readFile, readdir, lstat, realpath, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFile, getEditablePage, validatePageHtml } from './local-editor-core.mjs';
import { readTranslations, saveTranslation, applyTranslationDrafts, writeTranslationSource } from './local-translations.mjs';
import { readEventCatalog } from '../shared/read-events.mjs';
import { readReviews, writeReviews, reviewFile, describeReviews, applyReviews } from './event-reviews.mjs';
import { sitePages } from '../shared/site-pages.mjs';
import { readDraftSite, revisionOf, readPublication, publicationStatus, composeSitePage } from '../shared/site-publication.mjs';
import { renderEventPage, serializeEventCatalog } from '../shared/event-content.mjs';
import { allowed, requirePermission } from './policy.mjs';
import { assertSiteRevision, authorizeMutation, publicationAction, createSitePage } from './site-store.mjs';
import { codespaceHost, editorIdentity, editorRequestAllowed, editorOriginAllowed } from './environment.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const editorRoot = path.dirname(fileURLToPath(import.meta.url));

async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json'))
    throw Object.assign(new Error('JSON erwartet.'), { status: 415 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error('Anfrage ist zu groß.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 });
  }
}

async function savePage(id, value) {
  const file = contentFile(root, id);
  const directory = path.dirname(file);
  if (await realpath(directory) !== directory) throw new Error('Der Inhaltsordner darf keine Verknüpfung sein.');
  try {
    if ((await lstat(file)).isSymbolicLink()) throw new Error('Verknüpfte Inhaltsdateien können nicht bearbeitet werden.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const html = validatePageHtml(value);
  const temporary = path.join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, html, { flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

async function listMedia(directory = path.join(root, 'assets'), prefix = '') {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) results.push(...await listMedia(path.join(directory, entry.name), relative));
    else if (entry.isFile() && /\.(?:avif|jpe?g|png|svg|webp)$/i.test(entry.name))
      results.push({ src: `assets/${relative}`, name: entry.name });
  }
  return results.sort((a, b) => a.src.localeCompare(b.src));
}

export default function localEditor() {
  const identity=editorIdentity(root);
  const editorPort=process.env.BCB_EDITOR_PORT || '4321';
  const forwardedHost=codespaceHost(process.env,editorPort);
  const token = randomBytes(32).toString('hex');
  let enabled = false;
  let mutationQueue = Promise.resolve();
  return {
    name: 'bcb-local-content-editor',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        enabled = command === 'dev' && process.env.LOCAL_EDITOR === '1';
        if (enabled)
          updateConfig({ server: { host: '127.0.0.1', strictPort: true },vite:{server:{allowedHosts:forwardedHost?[forwardedHost]:[]}} });
      },
      'astro:server:setup': ({ server }) => {
        if (!enabled) return;
        server.middlewares.use(async (req, res, next) => {
          // Codespaces opens the forwarded port root; lead contributors into the editor.
          // Public site routes and the saved website preview remain directly accessible.
          if (forwardedHost && req.method === 'GET' && req.url === '/' && editorRequestAllowed(req,process.env,editorPort)) {
            res.writeHead(302, { Location: '/__editor/', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
            return res.end();
          }
          if (!req.url?.startsWith('/__editor')) return next();
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (!editorRequestAllowed(req,process.env,editorPort)) {
            res.statusCode = 403;
            return res.end('Nur lokal verfügbar.');
          }

          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const policy=JSON.parse(await readFile(path.join(root,'policy/content-rbac.json'),'utf8'));
            const requireRead=(resource,document)=>requirePermission(policy,identity,'read',resource,document);
            if(req.method==='GET' && url.pathname==='/__editor/api/site') {
              requireRead('publications',{id:'site'});
              res.setHeader('Content-Type','application/json; charset=utf-8');
              return res.end(JSON.stringify({...publicationStatus(root),canReview:allowed(policy,identity,'approve','publications',{id:'site'}),canPublish:allowed(policy,identity,'publish','publications',{id:'site'})}));
            }
            if(req.method==='GET' && url.pathname==='/__editor/site-i18n.js') {
              requireRead('translations',{id:'site'});
              res.setHeader('Content-Type','text/javascript; charset=utf-8');
              return res.end(url.searchParams.get('drafts')==='1'?await readFile(path.join(root,'i18n.js')):readPublication(root).active.snapshot.i18n);
            }
            if(req.method==='GET' && url.pathname==='/__editor/site-preview') {
              const drafts=url.searchParams.get('drafts')==='1',id=url.searchParams.get('id') || 'index';
              const sourcePage=sitePages(root).find(page=>page.id===id);
              if(drafts)requireRead('pages',sourcePage || {id});
              const source=drafts?readDraftSite(root):readPublication(root).active.snapshot;
              const snapshot=drafts?{...source,pages:source.pages.filter(page=>allowed(policy,identity,'read','pages',sitePages(root).find(item=>item.id===page.id))),events:{...source.events,events:source.events.events.filter(event=>allowed(policy,identity,'read','events',{id:event.id}))}}:source;
              const page=composeSitePage(snapshot,id);
              if(!page){res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<p>Diese Seite ist in diesem Website-Stand nicht freigegeben.</p>');}
              const catalog={...snapshot.events,revision:revisionOf(snapshot.events)};
              const html=renderEventPage(page.html,catalog,{page:page.path,locale:'de'});
              const head=renderEventPage(page.meta.head.join('\n'),catalog,{page:page.path,locale:'de'});
              res.setHeader('Content-Type','text/html; charset=utf-8');
              res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; base-uri 'self'; form-action 'none'; frame-ancestors 'self'");
              return res.end(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><link rel="stylesheet" href="/styles.css">${head}</head><body ${page.meta.bodyAttrs || ''} data-preview-drafts="${drafts?'1':'0'}"><aside role="status" style="padding:10px;background:#eee;color:#222">Lokale Website-Vorschau · ${drafts?'gespeicherte Entwürfe':'freigegebener Stand'} · Formulare deaktiviert</aside>${html}<script id="bcb-event-catalog" type="application/json">${serializeEventCatalog(catalog)}</script><script src="/__editor/site-i18n.js?drafts=${drafts?'1':'0'}" defer></script><script type="module" src="/__editor/site-preview.js"></script></body></html>`);
            }
            if(req.method==='GET' && ['/__editor/event-content.mjs','/__editor/journal.mjs'].includes(url.pathname)){
              res.setHeader('Content-Type','text/javascript; charset=utf-8');
              return res.end(await readFile(path.join(root,'shared',path.basename(url.pathname))));
            }
            if (req.method === 'GET' && ['/__editor', '/__editor/'].includes(url.pathname)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
              return res.end(await readFile(path.join(editorRoot, 'index.html')));
            }
            if (req.method === 'GET' && ['/__editor/client.js', '/__editor/editor.css', '/__editor/preview.css', '/__editor/history.mjs', '/__editor/content-model.mjs', '/__editor/section-layouts.mjs'].includes(url.pathname)) {
              const asset = url.pathname.endsWith('section-layouts.mjs') ? 'section-layouts.mjs' : url.pathname.endsWith('content-model.mjs') ? 'content-model.mjs' : url.pathname.endsWith('preview.css') ? 'preview.css' : url.pathname.endsWith('.css') ? 'editor.css' : url.pathname.endsWith('history.mjs') ? 'history.mjs' : 'client.js';
              res.setHeader('Content-Type', asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
              return res.end(await readFile(path.join(editorRoot, asset)));
            }
            if(req.method==='GET' && ['/__editor/page-navigation.mjs','/__editor/site-controls.mjs','/__editor/site-preview.js'].includes(url.pathname)) {
              res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(await readFile(path.join(editorRoot,path.basename(url.pathname))));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/pages') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
              const draft=readDraftSite(root);
              const pages=sitePages(root).filter(page=>allowed(policy,identity,'read','pages',page)).map(page=>({...page,title:draft.pages.find(item=>item.id===page.id).title}));
              return res.end(JSON.stringify({pages,token,identity:{label:identity.label,test:identity.test},canManageNavigation:allowed(policy,identity,'update','navigation',{id:'site'}),canCreate:allowed(policy,identity,'create','pages',{id:'new'})}));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/page') {
              const page = getEditablePage(url.searchParams.get('id'));
              if (!page) throw Object.assign(new Error('Unbekannte Seite.'), { status: 404 });
              requireRead('pages',page);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({page,html:await readFile(contentFile(root,page.id),'utf8'),revision:revisionOf(readDraftSite(root))}));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/translations') {
              requireRead('translations',{id:'site'});
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ translations: readTranslations(await readFile(path.join(root, 'i18n.js'), 'utf8')) }));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/metadata') {
              const page = getEditablePage(url.searchParams.get('id'));
              if(!page) throw new Error('Unbekannte Seite.');
              requireRead('pages',page);
              const catalog=await readEventCatalog(root,{draft:true}),event=eventForPage(catalog,page.path);
              if(event){
                const locale=url.searchParams.get('locale')==='en'?'en':'de';
                res.setHeader('Content-Type','application/json; charset=utf-8');
                return res.end(JSON.stringify({title:eventText(event,'content.PageTitle')?.[locale] || event.title[locale],description:eventText(event,'content.MetaDescription')?.[locale] || event.summary[locale]}));
              }
              if(page.titleKey) {
                const translations=readTranslations(await readFile(path.join(root,'i18n.js'),'utf8')),locale=url.searchParams.get('locale')==='en'?'en':'de';
                res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({title:translations[locale][page.titleKey],description:translations[locale][page.summaryKey]}));
              }
              const source = await readFile(path.join(root,'src/pages',page.id+'.astro'),'utf8');
              res.setHeader('Content-Type','application/json; charset=utf-8');
              return res.end(JSON.stringify(readMetadata(source)));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/events') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              const catalog=await readEventCatalog(root,{draft:true});
              catalog.events=catalog.events.filter(event=>allowed(policy,identity,'read','events',{id:event.id}));
              return res.end(JSON.stringify({...catalog,reviews:describeReviews(catalog,await readReviews(root))}));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/media') {
              requireRead('media',{id:'library'});
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ assets: await listMedia() }));
            }
            if (req.method === 'POST' && ['/__editor/api/site-action','/__editor/api/save', '/__editor/api/translation-save', '/__editor/api/event-save', '/__editor/api/media-prepare', '/__editor/api/text-create', '/__editor/api/metadata-save', '/__editor/api/navigation-save'].includes(url.pathname)) {
              if (!editorOriginAllowed(req,process.env,editorPort) || req.headers['sec-fetch-site'] === 'cross-site')
                throw Object.assign(new Error('Fremder Ursprung ist nicht erlaubt.'), { status: 403 });
              const supplied = req.headers['x-editor-token'];
              if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
                !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)))
                throw Object.assign(new Error('Editorsitzung ungültig. Bitte neu laden.'), { status: 403 });
              const body = await readJson(req);
              const previous = mutationQueue;
              let release;
              mutationQueue = new Promise(resolve => { release = resolve; });
              await previous;
              try {
              if(url.pathname==='/__editor/api/site-action') {
                let page;
                if(body.action==='create')page=await createSitePage(root,policy,identity,body);
                else await publicationAction(root,policy,identity,body);
                res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,page,revision:revisionOf(readDraftSite(root))}));
              }
              assertSiteRevision(root,body.revision);
              authorizeMutation(root,policy,identity,url.pathname.split('/').pop(),body);
              if (url.pathname === '/__editor/api/navigation-save') {
                const edits=[];
                for(const item of sitePages(root)) {
                  const html=await readFile(contentFile(root,item.id),'utf8');
                  const result=replaceNavigationLink(html,body.key,body.href,item.id);
                  if(result.count)edits.push({id:item.id,html,result});
                }
                if(!edits.length)throw new Error('Navigationslink nicht gefunden.');
                const written=[];
                try {for(const edit of edits){await savePage(edit.id,edit.result.html);written.push(edit);}}
                catch(error){for(const edit of written.reverse())await savePage(edit.id,edit.html);throw error;}
                res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,count:edits.length,revision:revisionOf(readDraftSite(root))}));
              }
              if (url.pathname === '/__editor/api/metadata-save') {
                const page = getEditablePage(body.id); if(!page)throw new Error('Unbekannte Seite.');
                const event=eventForPage(await readEventCatalog(root,{draft:true}),page.path);
                if(event){
                  if(!['de','en'].includes(body.locale) || !body.values || ['title','description'].some(field=>typeof body.values[field]!=='string'))throw new Error('Ungültige Eventmetadaten.');
                  const updates=[['content.PageTitle',body.values.title],['content.MetaDescription',body.values.description]].map(([field,value])=>({id:event.id,field,values:{...eventText(event,field),[body.locale]:value}}));
                  const source=JSON.parse(await readFile(path.join(root,'data/events.json'),'utf8'));
                  await writeEventSource(root,JSON.stringify(applyEventDrafts(source,updates),null,2)+'\n');
                  res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,revision:revisionOf(readDraftSite(root))}));
                }
                if(page.titleKey) {
                  const source=await readFile(path.join(root,'i18n.js'),'utf8');
                  const updated=applyTranslationDrafts(source,{[body.locale]:{[page.titleKey]:body.values.title,[page.summaryKey]:body.values.description}});
                  await writeTranslationSource(root,updated);
                  res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,revision:revisionOf(readDraftSite(root))}));
                }
                const file=path.join(root,'src/pages',page.id+'.astro');
                if((await lstat(file)).isSymbolicLink())throw new Error('Verknüpfte Seitendatei ist nicht erlaubt.');
                const updated=replaceMetadata(await readFile(file,'utf8'),body.values);
                const temporary=path.join(root,'src/pages','.'+randomUUID()+'.tmp');
                try{await writeFile(temporary,updated,{flag:'wx'});await rename(temporary,file);}
                finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
                res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,revision:revisionOf(readDraftSite(root))}));
              }
              if (url.pathname === '/__editor/api/media-prepare') {
                const result = await prepareMedia(root, body.src);
                res.setHeader('Content-Type','application/json; charset=utf-8');
                return res.end(JSON.stringify(result));
              }
              if (url.pathname === '/__editor/api/save') {
                validatePageHtml(body.html);
                if(!getEditablePage(body.id))throw new Error('Unbekannte Seite.');
                const original=await readFile(path.join(root,'i18n.js'),'utf8');
                const updated=applyTranslationDrafts(original,body.translations || {});
                const originalEvents=await readFile(path.join(root,'data/events.json'),'utf8');
                const eventData=applyEventDrafts(JSON.parse(originalEvents),body.events || []);
                const originalReviews=await readFile(reviewFile(root),'utf8');
                if((await lstat(reviewFile(root))).isSymbolicLink())throw new Error('Verknüpfte Prüfdatei ist nicht erlaubt.');
                const updatedReviews=JSON.stringify(applyReviews(eventData,JSON.parse(originalReviews),body.events || [],JSON.parse(originalEvents)),null,2)+'\n';
                const updatedEvents=body.events?.length?JSON.stringify(eventData,null,2)+'\n':originalEvents;
                try {
                  if(updated!==original)await writeTranslationSource(root,updated);
                  if(updatedEvents!==originalEvents)await writeEventSource(root,updatedEvents);
                  if(updatedReviews!==originalReviews)await writeReviews(root,updatedReviews);
                  await savePage(body.id,body.html);
                } catch(error) {
                  if(updatedReviews!==originalReviews)await writeReviews(root,originalReviews);
                  if(updatedEvents!==originalEvents)await writeEventSource(root,originalEvents);
                  if(updated!==original)await writeTranslationSource(root,original);
                  throw error;
                }
              }
              else if (url.pathname === '/__editor/api/event-save') {
                const file = path.join(root, 'data/events.json');
                if ((await lstat(file)).isSymbolicLink()) throw new Error('Verknüpfte Eventdatei ist nicht erlaubt.');
                const data = updateEventField(JSON.parse(await readFile(file, 'utf8')), body);
                await writeEventSource(root,JSON.stringify(data,null,2)+'\n');
              }
              else if (url.pathname === '/__editor/api/text-create') await saveTranslation(root, null, body.key, null, body.values);
              else await saveTranslation(root, body.locale, body.key, body.value);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ ok:true,revision:revisionOf(readDraftSite(root)) }));
              } finally { release(); }
            }
            throw Object.assign(new Error('Nicht gefunden.'), { status: 404 });
          } catch (error) {
            res.statusCode = error.status || 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ error: error.message }));
          }
        });
      },
    },
  };
}
