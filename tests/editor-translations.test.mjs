import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readTranslations, replaceTranslation, addTranslationPair } from '../editor/local-translations.mjs';

test('new content creates matching keys with an explicitly missing target locale', async () => {
  const source = await readFile(new URL('../i18n.js', import.meta.url), 'utf8');
  const updated = addTranslationPair(source,'editor_test',{de:'Neuer Inhalt',en:''});
  const translations = readTranslations(updated);
  assert.equal(translations.de.editor_test,'Neuer Inhalt');
  assert.equal(translations.en.editor_test,'');
  assert.equal(translations.de.navHome,readTranslations(source).de.navHome);
  assert.throws(()=>addTranslationPair(updated,'editor_test',{de:'Duplikat',en:''}));
  assert.throws(()=>addTranslationPair(source,'__proto__',{de:'a',en:'b'}));
  assert.throws(()=>addTranslationPair(source,'editor_test',{de:'<script>',en:''}));
  assert.equal(readTranslations(addTranslationPair(source,'editor_test',{de:'',en:'Only English'})).en.editor_test,'Only English');
  assert.throws(()=>addTranslationPair(source,'editor_test',{de:'',en:''}));
});

test('editor exposes the existing complete German and English dictionaries', async () => {
  const source = await readFile(new URL('../i18n.js', import.meta.url), 'utf8');
  const translations = readTranslations(source);
  assert.deepEqual(Object.keys(translations.de).sort(), Object.keys(translations.en).sort());
  assert.ok(Object.keys(translations.de).length > 200);
});

test('editor safely replaces only existing translation string values', async () => {
  const source = await readFile(new URL('../i18n.js', import.meta.url), 'utf8');
  const updated = replaceTranslation(source, 'en', 'navHome', `Home "new"\nline`);
  assert.equal(readTranslations(updated).en.navHome, `Home "new"\nline`);
  assert.equal(readTranslations(updated).de.navHome, 'Home');
  assert.throws(() => replaceTranslation(source, 'fr', 'navHome', 'Accueil'));
  assert.throws(() => replaceTranslation(source, 'en', 'missingKey', 'Missing'));
  assert.throws(() => replaceTranslation(source, 'en', 'htmlLang', 'fr'));
  assert.throws(() => replaceTranslation(source, 'en', 'navHome', 'x'.repeat(16001)));
});
