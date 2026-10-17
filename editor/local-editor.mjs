import { eventForPage, eventText } from '../shared/event-content.mjs';
import { replaceNavigationLink } from './navigation.mjs';
import { readMetadata, replaceMetadata } from './metadata.mjs';
import { updateEventField, applyEventDrafts, writeEventSource } from './events.mjs';
import { prepareMedia } from './media.mjs';
import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { readFile, readdir, lstat, realpath, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFile, editablePages, getEditablePage, isLocalRequest, validatePageHtml } from './local-editor-core.mjs';
import { readTranslations, saveTranslation, applyTranslationDrafts, writeTranslationSource } from './local-translations.mjs';
import { readEventCatalog } from '../shared/read-events.mjs';
import { readReviews, writeReviews, reviewFile, describeReviews, applyReviews } from './event-reviews.mjs';

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
  const token = randomBytes(32).toString('hex');
  let enabled = false;
  let mutationQueue = Promise.resolve();
  return {
    name: 'bcb-local-content-editor',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        enabled = command === 'dev' && process.env.LOCAL_EDITOR === '1';
        if (enabled)
          updateConfig({ server: { host: '127.0.0.1', strictPort: true } });
      },
      'astro:server:setup': ({ server }) => {
        if (!enabled) return;
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/__editor')) return next();
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (!isLocalRequest(req)) {
            res.statusCode = 403;
            return res.end('Nur lokal verfügbar.');
          }

          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            if(req.method==='GET' && url.pathname==='/__editor/event-content.mjs'){
              res.setHeader('Content-Type','text/javascript; charset=utf-8');
              return res.end(await readFile(path.join(root,'shared/event-content.mjs')));
            }
            if (req.method === 'GET' && ['/__editor', '/__editor/'].includes(url.pathname)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
              return res.end(await readFile(path.join(editorRoot, 'index.html')));
            }
            if (req.method === 'GET' && ['/__editor/client.js', '/__editor/editor.css', '/__editor/preview.css', '/__editor/history.mjs', '/__editor/content-model.mjs'].includes(url.pathname)) {
              const asset = url.pathname.endsWith('content-model.mjs') ? 'content-model.mjs' : url.pathname.endsWith('preview.css') ? 'preview.css' : url.pathname.endsWith('.css') ? 'editor.css' : url.pathname.endsWith('history.mjs') ? 'history.mjs' : 'client.js';
              res.setHeader('Content-Type', asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
              return res.end(await readFile(path.join(editorRoot, asset)));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/pages') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
              return res.end(JSON.stringify({ pages: editablePages, token }));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/page') {
              const page = getEditablePage(url.searchParams.get('id'));
              if (!page) throw Object.assign(new Error('Unbekannte Seite.'), { status: 404 });
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ page, html: await readFile(contentFile(root, page.id), 'utf8') }));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/translations') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ translations: readTranslations(await readFile(path.join(root, 'i18n.js'), 'utf8')) }));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/metadata') {
              const page = getEditablePage(url.searchParams.get('id'));
              if(!page) throw new Error('Unbekannte Seite.');
              const catalog=await readEventCatalog(root),event=eventForPage(catalog,page.path);
              if(event){
                const locale=url.searchParams.get('locale')==='en'?'en':'de';
                res.setHeader('Content-Type','application/json; charset=utf-8');
                return res.end(JSON.stringify({title:eventText(event,'content.PageTitle')?.[locale] || event.title[locale],description:eventText(event,'content.MetaDescription')?.[locale] || event.summary[locale]}));
              }
              const source = await readFile(path.join(root,'src/pages',page.id+'.astro'),'utf8');
              res.setHeader('Content-Type','application/json; charset=utf-8');
              return res.end(JSON.stringify(readMetadata(source)));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/events') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              const catalog=await readEventCatalog(root);
              return res.end(JSON.stringify({...catalog,reviews:describeReviews(catalog,await readReviews(root))}));
            }
            if (req.method === 'GET' && url.pathname === '/__editor/api/media') {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ assets: await listMedia() }));
            }
            if (req.method === 'POST' && ['/__editor/api/save', '/__editor/api/translation-save', '/__editor/api/event-save', '/__editor/api/media-prepare', '/__editor/api/text-create', '/__editor/api/metadata-save', '/__editor/api/navigation-save'].includes(url.pathname)) {
              if (req.headers.origin !== `http://${req.headers.host}` || req.headers['sec-fetch-site'] === 'cross-site')
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
              if (url.pathname === '/__editor/api/navigation-save') {
                const edits=[];
                for(const item of editablePages) {
                  const html=await readFile(contentFile(root,item.id),'utf8');
                  const result=replaceNavigationLink(html,body.key,body.href,item.id);
                  if(result.count)edits.push({id:item.id,html,result});
                }
                if(!edits.length)throw new Error('Navigationslink nicht gefunden.');
                const written=[];
                try {for(const edit of edits){await savePage(edit.id,edit.result.html);written.push(edit);}}
                catch(error){for(const edit of written.reverse())await savePage(edit.id,edit.html);throw error;}
                res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true,count:edits.length}));
              }
              if (url.pathname === '/__editor/api/metadata-save') {
                const page = getEditablePage(body.id); if(!page)throw new Error('Unbekannte Seite.');
                const event=eventForPage(await readEventCatalog(root),page.path);
                if(event){
                  if(!['de','en'].includes(body.locale) || !body.values || ['title','description'].some(field=>typeof body.values[field]!=='string'))throw new Error('Ungültige Eventmetadaten.');
                  const updates=[['content.PageTitle',body.values.title],['content.MetaDescription',body.values.description]].map(([field,value])=>({id:event.id,field,values:{...eventText(event,field),[body.locale]:value}}));
                  const source=JSON.parse(await readFile(path.join(root,'data/events.json'),'utf8'));
                  await writeEventSource(root,JSON.stringify(applyEventDrafts(source,updates),null,2)+'\n');
                  res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true}));
                }
                const file=path.join(root,'src/pages',page.id+'.astro');
                if((await lstat(file)).isSymbolicLink())throw new Error('Verknüpfte Seitendatei ist nicht erlaubt.');
                const updated=replaceMetadata(await readFile(file,'utf8'),body.values);
                const temporary=path.join(root,'src/pages','.'+randomUUID()+'.tmp');
                try{await writeFile(temporary,updated,{flag:'wx'});await rename(temporary,file);}
                finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
                res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:true}));
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
                const temporary = path.join(root, 'data', '.' + randomUUID() + '.tmp');
                try { await writeFile(temporary, JSON.stringify(data,null,2)+'\n', {flag:'wx'}); await rename(temporary,file); }
                finally { await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;}); }
                await writeFile(path.join(root,'public/data/events.json'), JSON.stringify(data,null,2)+'\n');
              }
              else if (url.pathname === '/__editor/api/text-create') await saveTranslation(root, null, body.key, null, body.values);
              else await saveTranslation(root, body.locale, body.key, body.value);
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({ ok: true }));
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
