import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { applyReviews, reviewStatus, describeReviews, readReviews } from '../editor/event-reviews.mjs';
import { applyEventDrafts } from '../editor/events.mjs';
import { readEventCatalog } from '../shared/read-events.mjs';

const data={events:[{id:'event',title:{de:'Quelle',en:'Translation'}}]};
const draft=(de='Quelle',en='Translation')=>({id:'event',field:'title',values:{de,en},review:{source:de,target:en,expectedSource:'Quelle',expectedTarget:'Translation'}});
test('review is explicit, bound to both text revisions and can reconfirm unchanged translation',()=>{
  assert.equal(reviewStatus(data.events[0].title),'unreviewed');
  const records=applyReviews(data,{},[draft()]);
  assert.equal(reviewStatus(data.events[0].title,records['event/title']),'reviewed');
  assert.equal(reviewStatus({de:'Neue Quelle',en:'Translation'},records['event/title']),'outdated');
  assert.equal(reviewStatus({de:'Quelle',en:'Edited'},records['event/title']),'changed');
  const changed=applyEventDrafts(data,[draft('Neue Quelle')]);
  const reviewed=applyReviews(changed,records,[draft('Neue Quelle')],data);
  assert.equal(reviewStatus(changed.events[0].title,reviewed['event/title']),'reviewed');
  assert.deepEqual(applyReviews(changed,records,[{id:'event',field:'title',values:changed.events[0].title}]),records);
});
test('missing languages and stale source confirmations cannot be approved',()=>{
  for(const values of [{de:'',en:'Text'},{de:'Text',en:' '},{de:'',en:''}])assert.equal(reviewStatus(values),'missing');
  assert.throws(()=>applyReviews(data,{},[{...draft(),review:{...draft().review,expectedSource:'old'}}]),/Textstand/);
  assert.throws(()=>applyReviews(data,{},[{...draft(),review:{...draft().review,expectedTarget:'old'}}]),/Textstand/);
  assert.throws(()=>applyReviews(data,{},[{...draft(),review:{...draft().review,target:'different'}}]),/Textstand/);
});
test('import baseline is unreviewed and editorial records do not affect public revision',async()=>{
  const root=process.cwd(),catalog=await readEventCatalog(root),records=await readReviews(root);
  const descriptions=describeReviews(catalog,records);
  assert.ok(Object.values(descriptions).some(value=>value.status==='unreviewed'));
  assert.ok(!JSON.stringify(catalog).includes('expectedSource'));
  assert.ok(!JSON.stringify(catalog).includes('reviews'));
  const built=await readFile('public/data/events.json','utf8');
  assert.ok(!built.includes('expectedSource'));
  assert.ok(!built.includes('reviews'));
  await assert.rejects(access('dist/editor/event-reviews.json'));
  await assert.rejects(access('dist/editor/event-reviews.mjs'));
});
