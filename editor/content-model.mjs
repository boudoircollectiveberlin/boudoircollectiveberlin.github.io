import { sectionLayouts } from './section-layouts.mjs';

export function insertionAllowed(type, position, target) {
  if (!sectionLayouts.some(item => item.id === type) || !['before','after','inside'].includes(position) ||
    !target || target.blocked || !target.inMain || !target.insertionRoot) return false;
  if (position === 'inside') return ['MAIN','SECTION'].includes(target.tag);
  return target.tag !== 'MAIN' && ['MAIN','SECTION','ARTICLE','DIV'].includes(target.parentTag);
}

export function localizedValue(translations, drafts, key, locale, original = '') {
  const other = locale === 'de' ? 'en' : 'de';
  const value = language => Object.hasOwn(drafts?.[language] || {}, key) ? drafts[language][key] : translations?.[language]?.[key];
  const own = value(locale);
  const fallback = value(other);
  const missing = typeof own !== 'string' || !own.trim();
  return { text: missing ? (fallback?.trim() ? fallback : original) : own, missing, source: fallback?.trim() ? other : null };
}

export function missingOtherLanguage(translations, drafts, key, locale) {
  const other=locale==='de'?'en':'de';
  const value=Object.hasOwn(drafts?.[other] || {},key)?drafts[other][key]:translations?.[other]?.[key];
  return typeof value==='string' && value.trim() ? '' : other;
}
