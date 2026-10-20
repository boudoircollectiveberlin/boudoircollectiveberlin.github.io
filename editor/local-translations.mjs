import { parse } from '@babel/parser';
import { lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readPublication } from '../shared/publication-state.mjs';

function translationProperties(source) {
  const ast = parse(source, { sourceType: 'script' });
  const declaration = ast.program.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations)
    .find((node) => node.id.type === 'Identifier' && node.id.name === 'translations');
  if (declaration?.init?.type !== 'ObjectExpression') throw new Error('Übersetzungsstruktur in i18n.js nicht gefunden.');
  const locales = new Map();
  for (const locale of declaration.init.properties) {
    const localeName = propertyName(locale.key);
    if (!['de', 'en'].includes(localeName) || locale.value.type !== 'ObjectExpression') continue;
    const keys = new Map();
    for (const entry of locale.value.properties) {
      const key = propertyName(entry.key);
      if (!key || entry.type !== 'ObjectProperty' || entry.value.type !== 'StringLiteral')
        throw new Error(`Nicht unterstützter Übersetzungseintrag in ${localeName}.`);
      keys.set(key, entry.value);
    }
    locales.set(localeName, keys);
  }
  if (locales.size !== 2) throw new Error('Es werden deutsche und englische Übersetzungen erwartet.');
  return locales;
}

function propertyName(node) {
  return node.type === 'Identifier' ? node.name : node.type === 'StringLiteral' ? node.value : null;
}

export function readTranslations(source) {
  const properties = translationProperties(source);
  return Object.fromEntries([...properties].map(([locale, entries]) => [
    locale,
    Object.fromEntries([...entries].map(([key, node]) => [key, node.value])),
  ]));
}

export function replaceTranslation(source, locale, key, value) {
  if (!['de', 'en'].includes(locale) || typeof key !== 'string' || key === 'htmlLang' ||
    typeof value !== 'string' || value.length > 16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
    throw new Error('Ungültiger Übersetzungseintrag.');
  const node = translationProperties(source).get(locale)?.get(key);
  if (!node) throw new Error('Unbekannter Übersetzungsschlüssel.');
  return source.slice(0, node.start) + JSON.stringify(value) + source.slice(node.end);
}

export function addTranslationPair(source, key, values) {
  if (!/^editor_[a-z0-9_]{1,80}$/.test(key) || !values ||
    ['de','en'].some(locale => typeof values[locale] !== 'string' || values[locale].length > 16000 || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(values[locale])) || !(values.de.trim() || values.en.trim()))
    throw new Error('Ungültiger neuer Text.');
  const properties = translationProperties(source);
  if ([...properties.values()].some(entries => entries.has(key))) throw new Error('Textschlüssel existiert bereits.');
  const insertions = ['de','en'].map(locale => {
    const entries = [...properties.get(locale).values()];
    return { position: entries.at(-1).end, text: `,\n    ${JSON.stringify(key)}: ${JSON.stringify(values[locale])}` };
  }).sort((a,b) => b.position-a.position);
  for (const {position,text} of insertions) source = source.slice(0,position)+text+source.slice(position);
  readTranslations(source);
  return source;
}

export async function saveTranslation(root, locale, key, value, pair) {
  const sourceFile = path.resolve(root, 'i18n.js');
  try {
    if ((await lstat(sourceFile)).isSymbolicLink()) throw new Error('Verknüpfte Übersetzungsdatei kann nicht bearbeitet werden.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const source = await readFile(sourceFile, 'utf8');
  const updated = pair ? addTranslationPair(source, key, pair) : replaceTranslation(source, locale, key, value);
  const temporary = path.join(root, `.i18n-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, updated, { flag: 'wx' });
    await rename(temporary, sourceFile);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  await writeFile(path.join(root, 'public', 'i18n.js'), readPublication(root).active.snapshot.i18n);
}

export function applyTranslationDrafts(source, drafts = {}) {
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts) || Object.keys(drafts).some(locale => !['de','en'].includes(locale))) throw new Error('Ungültige Sprachentwürfe.');
  for (const values of Object.values(drafts)) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Ungültige Sprachentwürfe.');
  }
  const existing = readTranslations(source);
  const keys = new Set([...Object.keys(drafts.de || {}), ...Object.keys(drafts.en || {})]);
  if (keys.size > 500) throw new Error('Zu viele Textänderungen.');
  for (const key of keys) {
    if (!Object.hasOwn(existing.de,key) && !Object.hasOwn(existing.en,key)) {
      source = addTranslationPair(source,key,{de:drafts.de?.[key] || '',en:drafts.en?.[key] || ''});
    } else {
      for (const locale of ['de','en']) if (Object.hasOwn(drafts[locale] || {},key)) source = replaceTranslation(source,locale,key,drafts[locale][key]);
    }
  }
  return source;
}

export async function writeTranslationSource(root, source) {
  readTranslations(source);
  const file = path.join(root,'i18n.js');
  if ((await lstat(file)).isSymbolicLink()) throw new Error('Verknüpfte Übersetzungsdatei ist nicht erlaubt.');
  const temporary = path.join(root,`.i18n-${randomUUID()}.tmp`);
  try { await writeFile(temporary,source,{flag:'wx'}); await rename(temporary,file); }
  finally { await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;}); }
  await writeFile(path.join(root,'public/i18n.js'),readPublication(root).active.snapshot.i18n);
}
