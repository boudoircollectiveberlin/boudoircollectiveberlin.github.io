export const components = Object.freeze([
  { id: 'section', label: 'Abschnitt', tag: 'section', container: true },
  { id: 'container', label: 'Container', tag: 'div', container: true },
  { id: 'columns', label: 'Zwei Spalten', tag: 'div', container: true },
  { id: 'heading', label: 'Überschrift', tag: 'h2', text: 'Neue Überschrift' },
  { id: 'text', label: 'Text', tag: 'p', text: 'Neuer Text' },
  { id: 'link', label: 'Link / Schaltfläche', tag: 'a', text: 'Linktext' },
]);

export function insertionAllowed(type, position, target) {
  if (!components.some(item => item.id === type) || !['before','after','inside'].includes(position) || !target || target.blocked || !target.inMain) return false;
  const parent = position === 'inside' ? target.tag : target.parentTag;
  if (position !== 'inside' && target.tag === 'MAIN') return false;
  return ['MAIN','SECTION','ARTICLE','DIV','ASIDE'].includes(parent);
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
