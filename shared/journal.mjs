import { escapeEventHtml } from './event-content.mjs';

export function renderJournalList(pages,translations,{locale='de'}={}) {
  const text=key=>translations[locale]?.[key]?.trim() || translations.de?.[key] || translations.en?.[key] || '';
  return pages.filter(page=>page.type==='article').map(page=>`<article class="bcb-journal-entry"><h2><a href="${escapeEventHtml(page.path)}" data-bcb-journal-page="${escapeEventHtml(page.id)}" data-i18n="${escapeEventHtml(page.titleKey)}">${escapeEventHtml(text(page.titleKey))}</a></h2><p data-i18n="${escapeEventHtml(page.summaryKey)}">${escapeEventHtml(text(page.summaryKey))}</p></article>`).join('');
}
