import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readMetadata, replaceMetadata } from '../editor/metadata.mjs';

test('metadata edits survive special characters and preserve page rendering', async () => {
  const source=await readFile(new URL('../src/pages/index.astro',import.meta.url),'utf8');
  const values={title:'Test "Titel" & <Text>',description:'Beschreibung mit & und "Text"'};
  const result=replaceMetadata(source,values);
  assert.deepEqual(readMetadata(result),values);
  assert.ok(result.includes('<Layout {...meta}><Fragment set:html={body} /></Layout>'));
  assert.ok(result.includes('og:image'));
  assert.throws(()=>replaceMetadata(source,{title:'',description:'a'}));
  assert.throws(()=>replaceMetadata(source,{title:'a\n---',description:'b'}));
});
