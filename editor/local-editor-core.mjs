import path from 'node:path';
import { validateSectionLayoutMarkers } from './section-layouts.mjs';
import { basePages, sitePages } from '../shared/site-pages.mjs';

export const editablePages = basePages;

export function getEditablePage(id,root=process.cwd()) {
  return sitePages(root).find(page=>page.id===id);
}

export function contentFile(root, id) {
  const page = getEditablePage(id,root);
  if (!page) throw new Error('Unbekannte Seite.');
  const directory = path.resolve(root, 'src', 'content', 'pages');
  const file = path.resolve(directory, page.path);
  if (!file.startsWith(`${directory}${path.sep}`)) throw new Error('Ungültiger Seitenpfad.');
  return file;
}

export function validatePageHtml(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 1024 * 1024)
    throw new Error('Der Seiteninhalt muss Text sein und darf höchstens 1 MB groß sein.');
  if (/<\/?(?:script|iframe|object|embed|base|style|link|meta)\b|\son[a-z]+\s*=|javascript\s*:/i.test(value))
    throw new Error('Aktive Inhalte und Ereignisattribute sind im Editor nicht erlaubt.');
  if (/<\s*(?:!doctype|html|head|body)\b/i.test(value))
    throw new Error('Bitte nur den Seiteninhalt ohne Dokumenthülle speichern.');
  validateSectionLayoutMarkers(value);
  return value;
}

export function isLocalRequest(req) {
  try {
    const host = new URL(`http://${req.headers.host}`);
    const remote = req.socket.remoteAddress?.replace(/^::ffff:/, '');
    return host.host === req.headers.host.toLowerCase() &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname) &&
      ['127.0.0.1', '::1'].includes(remote);
  } catch {
    return false;
  }
}
