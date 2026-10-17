import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as model from '../shared/event-content.mjs';
import { readEventCatalog } from '../shared/read-events.mjs';
import { updateEventField } from '../editor/events.mjs';
import { readTranslations } from '../editor/local-translations.mjs';

test('public event projection excludes private/unrecognized fields and has stable revision',async()=>{
  const first=await readEventCatalog(process.cwd()),second=await readEventCatalog(process.cwd());
  assert.equal(first.revision,second.revision);
  assert.equal(first.schemaVersion,1);
  const source=structuredClone(first);
  source.internalNotes='private';source.events[0].participants=[{email:'private@example.invalid'}];
  source.events[0].content.PrivateNotes={de:'privat',en:'private'};
  const output=JSON.stringify(model.publicEventCatalog(source));
  assert.ok(!output.includes('private@example.invalid'));assert.ok(!output.includes('PrivateNotes'));assert.ok(!output.includes('internalNotes'));
  assert.throws(()=>model.publicEventCatalog({...first,events:[first.events[0],first.events[0]]}));
});

test('one title/cost update drives list and detail rendering while preserving application structure',async()=>{
  const source=await readEventCatalog(process.cwd());
  const event=source.events.find(event=>event.detailPage==='event-wrodow.html');
  let updated=updateEventField(source,{id:event.id,field:'title',values:{de:'Gemeinsamer Titel',en:'Shared title'}});
  updated=updateEventField(updated,{id:event.id,field:'cost',values:{de:'Unveröffentlichter Test',en:'Unpublished test'}});
  const card=model.renderEventCard(updated.events.find(item=>item.id===event.id),{locale:'en'});
  const html=await readFile('src/content/pages/event-wrodow.html','utf8');
  const detail=model.renderEventPage(html,updated,{page:'event-wrodow.html',locale:'en'});
  assert.ok(card.includes('Shared title'));assert.ok(detail.includes('Shared title'));
  assert.ok(card.includes('Unpublished test'));assert.ok(detail.includes('Unpublished test'));
  assert.ok(detail.includes('id="register-form"'));assert.ok(detail.includes('id="application"'));
  assert.equal(source.events.find(item=>item.id===event.id).title.en,event.title.en);
});

test('detail copy and image descriptions are editable public event resources, not duplicated dictionary entries',async()=>{
  const source=await readEventCatalog(process.cwd());
  const event=source.events.find(event=>event.detailPage==='event-wrodow.html');
  const changed=updateEventField(source,{id:event.id,field:'content.HeroCopy',values:{de:'Quelltext',en:'Editorial copy'}});
  const html=await readFile('src/content/pages/event-wrodow.html','utf8');
  const detail=model.renderEventPage(html,changed,{page:'event-wrodow.html',locale:'en'});
  assert.ok(detail.includes('Editorial copy'));
  assert.ok(detail.includes(model.escapeEventHtml(event.content.AltSommer.en)));
  const translations=readTranslations(await readFile('i18n.js','utf8'));
  assert.equal(translations.de.wrodowHeroTitle,undefined);
  assert.equal(translations.de.wrodowHeroCopy,undefined);
  assert.ok(translations.de.grabowseeLoginRequiredTitle,'operational auth UI remains available');
  assert.throws(()=>updateEventField(source,{id:event.id,field:'content.PrivateNotes',values:{de:'a',en:'b'}}));
});

test('renderer escapes plain copy, validates paths and rejects active rich content',async()=>{
  const catalog=await readEventCatalog(process.cwd()),event=structuredClone(catalog.events[0]);
  event.title.de='<img src=x onerror=alert(1)>';
  assert.ok(model.renderEventCard(event).includes('&lt;img'));
  assert.throws(()=>model.safeEventRichText('<a href="javascript:alert(1)">x</a>'));
  assert.throws(()=>model.safeEventRichText('<iframe src="x"></iframe>'));
  assert.throws(()=>model.safeEventRichText('<a href="&#x6a;avascript:alert(1)">x</a>'));
  assert.throws(()=>model.safeEventRichText('<a href=https://example.com onclick=alert(1)>x</a>'));
  const malicious=structuredClone(catalog);malicious.events[0].coverImage="assets/x');color:red";
  assert.throws(()=>model.publicEventCatalog(malicious));
  assert.ok(!model.serializeEventCatalog({text:'</script><script>alert(1)</script>'}).includes('</script>'));
});

test('built pages embed the same catalog and card renderer, with no editor-only markup',async()=>{
  const catalog=await readEventCatalog(process.cwd());
  const built=await readFile('dist/index.html','utf8');
  const embedded=JSON.parse(/<script\b[^>]*id="bcb-event-catalog"[^>]*>([\s\S]*?)<\/script>/.exec(built)[1]);
  assert.equal(embedded.revision,catalog.revision);
  for(const event of catalog.events)assert.ok(built.includes(model.renderEventCard(event)),event.id);
  assert.ok(!built.includes('data-editor-'));
  assert.ok(!built.includes('DE / EN bearbeiten'));
});

test('actual browser event loader uses embedded snapshot or exactly one same-origin JSON read',async()=>{
  const script=await readFile('script.js','utf8');
  const loader=script.slice(script.indexOf('async function loadEvents()'),script.indexOf('function renderEvents(events)'));
  const catalog=await readEventCatalog(process.cwd());
  let reads=0;
  const context={eventContent:model,eventContentReady:Promise.resolve(model),document:{getElementById:()=>({textContent:JSON.stringify(catalog)})},fetch:async()=>{reads++;throw new Error('Unexpected backend call');}};
  vm.createContext(context);vm.runInContext(loader,context);
  assert.equal((await context.loadEvents()).length,catalog.events.length);assert.equal(reads,0);
  context.document.getElementById=()=>null;
  context.fetch=async url=>{reads++;assert.equal(url,'data/events.json');return {ok:true,json:async()=>catalog};};
  assert.equal((await context.loadEvents()).length,catalog.events.length);assert.equal(reads,1);
});
