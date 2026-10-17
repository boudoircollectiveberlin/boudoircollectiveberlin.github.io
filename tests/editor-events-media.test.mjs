import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { prepareMedia } from '../editor/media.mjs';
import { updateEventField, applyEventDrafts } from '../editor/events.mjs';

test('inline event drafts apply together without mutating source or accepting operational fields',()=>{
  const source={events:[{id:'test',group:'past',title:{de:'Alt',en:'Old'},summary:{de:'Text',en:'Copy'}}]};
  const result=applyEventDrafts(source,[{id:'test',field:'title',values:{de:'Neu',en:'New'}},{id:'test',field:'summary',values:{de:'Text',en:''}}]);
  assert.equal(result.events[0].title.en,'New');
  assert.equal(result.events[0].summary.en,'');
  assert.equal(source.events[0].title.en,'Old');
  assert.throws(()=>applyEventDrafts(source,[{id:'test',field:'group',values:{de:'upcoming',en:'upcoming'}}]));
  assert.throws(()=>applyEventDrafts(source,{}));
});

test('event edits update both locales together and preserve unrelated fields', () => {
  const data = { events: [{id:'test', group:'past', title:{de:'Alt',en:'Old'},capacity:{models:2}}] };
  const changed = updateEventField(data,{id:'test',field:'title',values:{de:'Neu',en:'New'}});
  assert.deepEqual(changed.events[0].title,{de:'Neu',en:'New'});
  assert.equal(data.events[0].title.de,'Alt');
  assert.deepEqual(changed.events[0].capacity,{models:2});
  assert.equal(changed.events[0].group,'past');
  for (const patch of [{id:'missing'},{field:'capacity'},{values:{de:'Only German'}},{values:{de:'a',en:'b',fr:'c'}},{values:{de:'a',en:'x'.repeat(16001)}}])
    assert.throws(()=>updateEventField(data,{id:'test',field:'title',values:{de:'Neu',en:'New'},...patch}));
});

test('WebP conversion preserves original and produces a bounded reusable image', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'bcb-media-'));
  try {
    await mkdir(path.join(root,'assets'));
    const original = await sharp({create:{width:2400,height:100,channels:3,background:'#735544'}}).png().toBuffer();
    const {writeFile} = await import('node:fs/promises');
    await writeFile(path.join(root,'assets/source.png'),original);
    const result = await prepareMedia(root,'assets/source.png');
    assert.match(result.src,/^assets\/editor-webp\/[a-f0-9]+\.webp$/);
    const converted = await sharp(await readFile(path.join(root,result.src))).metadata();
    assert.equal(converted.format,'webp'); assert.equal(converted.width,1920);
    assert.deepEqual(await readFile(path.join(root,'assets/source.png')),original);
    assert.deepEqual(await prepareMedia(root,'assets/source.png'),result);
    await assert.rejects(prepareMedia(root,'assets/../package.json'));
    await assert.rejects(prepareMedia(root,'assets/../../outside.png'));
  } finally { await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}); }
});
