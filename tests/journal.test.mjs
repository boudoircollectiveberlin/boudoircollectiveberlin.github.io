import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readDraftSite, readPublication, composeSitePage } from '../shared/site-publication.mjs';
import { readTranslations } from '../editor/local-translations.mjs';
import { renderJournalList } from '../shared/journal.mjs';
import { validatePageHtml } from '../editor/local-editor-core.mjs';

test('journal placeholder and overview are editable drafts and absent from the public release',()=>{
  const draft=readDraftSite(process.cwd()),active=readPublication(process.cwd()).active.snapshot;
  const overview=draft.pages.find(page=>page.type==='journal'),article=draft.pages.find(page=>page.id==='redaktion-lorem-ipsum');
  assert.ok(overview && article);
  validatePageHtml(overview.html);validatePageHtml(article.html);
  const translations=readTranslations(draft.i18n);
  assert.match(translations.de[article.titleKey],/virtueller Testartikel/);
  assert.match(translations.en[article.titleKey],/virtual test article/);
  assert.equal(composeSitePage(active,article.id),null);
  assert.equal(composeSitePage(active,overview.id),null);
  assert.ok(!composeSitePage(active,'index').html.includes(overview.path));
  assert.ok(composeSitePage(draft,'index').html.includes(overview.path));
  assert.ok(composeSitePage(draft,overview.id).html.includes(article.path));
  const empty={...draft,pages:draft.pages.filter(page=>page.type!=='article')};
  assert.ok(!composeSitePage(empty,'index').html.includes('href="'+overview.path+'"'));
});

test('journal overview uses central localized titles and summaries and escapes text',()=>{
  const draft=readDraftSite(process.cwd()),translations=readTranslations(draft.i18n),article=draft.pages.find(page=>page.type==='article');
  translations.en[article.titleKey]='A different title <safe>';
  translations.en[article.summaryKey]='A central summary';
  const html=renderJournalList(draft.pages,translations,{locale:'en'});
  assert.ok(html.includes('A different title &lt;safe&gt;'));
  assert.ok(html.includes('A central summary'));
  assert.ok(html.includes('data-bcb-journal-page="'+article.id+'"'));
});

test('static build keeps the unapproved journal and lorem ipsum out of website output',async()=>{
  const home=await readFile('dist/index.html','utf8'),dictionary=await readFile('dist/i18n.js','utf8');
  assert.ok(!home.includes('redaktion-journal.html'));
  assert.ok(!dictionary.includes('editor_journal_test_body_one'));
  await assert.rejects(readFile('dist/redaktion-lorem-ipsum.html'));
  await assert.rejects(readFile('dist/redaktion-journal.html'));
});
