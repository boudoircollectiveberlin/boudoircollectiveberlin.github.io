import path from 'node:path';

export const editablePages = Object.freeze([
  { id: 'index', title: 'Startseite', path: 'index.html' },
  { id: 'account', title: 'Account', path: 'account.html' },
  { id: 'event-grabowsee', title: 'Event: Grabowsee', path: 'event-grabowsee.html' },
  { id: 'event-wrodow', title: 'Event: Wrodow', path: 'event-wrodow.html' },
  { id: 'legal', title: 'Rechtliches', path: 'legal.html' },
]);

const pagesById = new Map(editablePages.map((page) => [page.id, page]));

export function getEditablePage(id) {
  return pagesById.get(id);
}

export function contentFile(root, id) {
  const page = getEditablePage(id);
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
