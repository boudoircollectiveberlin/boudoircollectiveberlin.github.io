import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { allowed, localOperator } from '../editor/policy.mjs';
import { readDraftSite, readPublication, revisionOf, composeSitePage, publicationStatus } from '../shared/site-publication.mjs';
import { createSitePage, publicationAction, assertSiteRevision, authorizeMutation } from '../editor/site-store.mjs';
import { writeEventSource } from '../editor/events.mjs';
import { writeTranslationSource, applyTranslationDrafts } from '../editor/local-translations.mjs';
import { readEventCatalog } from '../shared/read-events.mjs';
import { pageNavigationEntries, filterNavigationEntries } from '../editor/page-navigation.mjs';

const policy=JSON.parse(await readFile('policy/content-rbac.json','utf8'));
const actor=(role,extra={})=>({id:'test-actor',roles:[role],...extra});
async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'bcb-publication-'));
  t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.join(path.resolve(tmpdir()),'bcb-publication-')));await rm(root,{recursive:true,force:true});});
  for(const dir of ['content','data','src/pages','src/content/pages'])await cp(dir,path.join(root,dir),{recursive:true});
  await cp('i18n.js',path.join(root,'i18n.js'));
  await mkdir(path.join(root,'public/data'),{recursive:true});
  return root;
}
const current=root=>({revision:revisionOf(readDraftSite(root)),activeRevision:readPublication(root).active.revision,confirm:true});
const newPage=root=>({action:'create',revision:revisionOf(readDraftSite(root)),slug:'pruefartikel',type:'article',values:{de:'Unfreigegebener Prüfartikel',en:'Draft article'},summary:{de:'Nur im Entwurf sichtbar.',en:'Visible in draft only.'},navigation:true});

test('policy applies document and language restrictions together and separates review from publication',()=>{
  const editor=actor('editor',{documents:['event-wrodow'],languages:['en']});
  assert.equal(allowed(policy,editor,'update','events',{id:'event-wrodow',locale:'en'}),true);
  assert.equal(allowed(policy,editor,'update','events',{id:'event-wrodow',locale:'de'}),false);
  assert.equal(allowed(policy,editor,'update','events',{id:'another',locale:'en'}),false);
  assert.equal(allowed(policy,editor,'publish','publications',{id:'site'}),false);
  assert.equal(allowed(policy,actor('reviewer'),'approve','publications',{id:'site'}),true);
  assert.equal(allowed(policy,actor('reviewer'),'publish','publications',{id:'site'}),false);
  assert.equal(allowed(policy,actor('publisher'),'approve','publications',{id:'site'}),false);
  assert.equal(allowed(policy,actor('translator',{languages:['en']}),'update','translations',{id:'key',locale:'en'}),true);
  assert.equal(allowed(policy,actor('translator',{languages:['en']}),'update','pages',{id:'index'}),false);
  assert.equal(allowed(policy,{roles:['local-operator']},'publish','publications'),false);
  assert.equal(allowed(policy,actor('unknown'),'update','pages',{id:'index'}),false);
});

test('area and word search scale independently of page selection',()=>{
  const pages=Array.from({length:150},(_,index)=>({id:'a'+index,path:'redaktion-'+index+'.html',title:'Über Haltung '+index,area:'Redaktion',type:'article'}));
  const entries=pageNavigationEntries([...pages,{id:'index',path:'index.html',title:'Startseite',area:'Website'}]);
  assert.equal(filterNavigationEntries(entries,'Redaktion','uber haltung 149')[0].id,'a149');
  assert.equal(filterNavigationEntries(entries,'Redaktion').length,150);
  assert.equal(filterNavigationEntries(entries,'Website','haltung').length,0);
});

test('create, review, publish, edit and withdraw preserve immutable public snapshots and shared teaser metadata',async t=>{
  const root=await fixture(t),original=readPublication(root).active;
  const page=await createSitePage(root,policy,localOperator,newPage(root));
  const draft=readDraftSite(root);
  assert.equal(composeSitePage(original.snapshot,page.id),null);
  assert.ok(!composeSitePage(original.snapshot,'index').html.includes(page.path));
  assert.ok(composeSitePage(draft,'index').html.includes(page.titleKey));
  assert.ok(composeSitePage(draft,'index').html.includes(page.summaryKey));
  assert.ok(composeSitePage(draft,'index').html.includes('Unfreigegebener Prüfartikel'));
  await assert.rejects(publicationAction(root,policy,localOperator,{...current(root),action:'publish'}),/zuerst geprüft/);
  await assert.rejects(publicationAction(root,policy,actor('editor'),{...current(root),action:'review',roles:['local-operator']}),error=>error.status===403);
  await publicationAction(root,policy,actor('reviewer'),{...current(root),action:'review'});
  assert.equal(readPublication(root).active.revision,original.revision);
  const body=await readFile(path.join(root,'src/content/pages',page.path),'utf8');
  await writeFile(path.join(root,'src/content/pages',page.path),body+'\n');
  await assert.rejects(publicationAction(root,policy,actor('publisher'),{...current(root),action:'publish'}),/zuerst geprüft/);
  await writeFile(path.join(root,'src/content/pages',page.path),body);
  await publicationAction(root,policy,actor('publisher'),{...current(root),action:'publish'});
  assert.ok(composeSitePage(readPublication(root).active.snapshot,page.id));
  await writeFile(path.join(root,'src/content/pages',page.path),body+'<p>NEVER_APPROVED_BODY</p>');
  assert.ok(!JSON.stringify(readPublication(root).active.snapshot).includes('NEVER_APPROVED_BODY'));
  await publicationAction(root,policy,actor('publisher'),{...current(root),action:'withdraw'});
  assert.equal(readPublication(root).active.revision,original.revision);
  assert.equal(composeSitePage(readPublication(root).active.snapshot,page.id),null);
  assert.ok(JSON.stringify(readDraftSite(root)).includes('NEVER_APPROVED_BODY'));
  assert.equal(readPublication(root).audit.length,3);
});

test('draft event/dictionary changes never replace public mirrors or public API data; all writes reject stale revisions',async t=>{
  const root=await fixture(t),revision=revisionOf(readDraftSite(root)),publicEvents=await readEventCatalog(root);
  const events=JSON.parse(await readFile(path.join(root,'data/events.json'),'utf8'));
  events.events[0].title.de='NEVER_APPROVED_EVENT';
  await writeEventSource(root,JSON.stringify(events));
  assert.throws(()=>assertSiteRevision(root,revision),error=>error.status===409);
  assert.equal((await readEventCatalog(root)).revision,publicEvents.revision);
  assert.ok(!String(await readFile(path.join(root,'public/data/events.json'))).includes('NEVER_APPROVED_EVENT'));
  const source=await readFile(path.join(root,'i18n.js'),'utf8');
  const changed=applyTranslationDrafts(source,{de:{editor_testdraft:'NEVER_APPROVED_DICTIONARY'},en:{editor_testdraft:''}});
  await writeTranslationSource(root,changed);
  assert.ok(!String(await readFile(path.join(root,'public/i18n.js'))).includes('NEVER_APPROVED_DICTIONARY'));
  assert.ok(publicationStatus(root).translationsChanged);
  assert.ok(publicationStatus(root).eventsChanged);
  assert.throws(()=>authorizeMutation(root,policy,actor('translator',{languages:['en']}),'save',{id:'index',html:readDraftSite(root).pages[0].html,translations:{de:{navHome:'Changed'}}}),error=>error.status===403);
  assert.throws(()=>authorizeMutation(root,policy,actor('editor',{documents:['index']}),'navigation-save',{}),error=>error.status===403);
});

test('page creation rejects paths, duplicates and stale requests without mutating files',async t=>{
  const root=await fixture(t),request=newPage(root);
  await assert.rejects(createSitePage(root,policy,localOperator,{...request,slug:'../api/admin'}));
  await createSitePage(root,policy,localOperator,request);
  await assert.rejects(createSitePage(root,policy,localOperator,request),error=>error.status===409);
  await assert.rejects(createSitePage(root,policy,localOperator,{...request,revision:revisionOf(readDraftSite(root))}),/existiert bereits/);
});
