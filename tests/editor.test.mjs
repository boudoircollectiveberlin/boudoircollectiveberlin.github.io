import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { contentFile, editablePages, getEditablePage, isLocalRequest, validatePageHtml } from '../editor/local-editor-core.mjs';

test('editor exposes only the five migrated BCB pages', () => {
  assert.equal(editablePages.length, 5);
  assert.equal(getEditablePage('event-wrodow').path, 'event-wrodow.html');
  assert.equal(getEditablePage('../api/register'), undefined);
  assert.throws(() => contentFile(process.cwd(), '../api/register'), /Unbekannte Seite/);
});

test('editor accepts page fragments and rejects active content', () => {
  assert.equal(validatePageHtml('<main><h1>BCB</h1></main>'), '<main><h1>BCB</h1></main>');
  for (const html of [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">Link</a>',
    '<!doctype html><html></html>',
  ]) assert.throws(() => validatePageHtml(html));
  assert.throws(() => validatePageHtml('x'.repeat(1024 * 1024 + 1)), /1 MB/);
});

test('editor requests require loopback peer and loopback host', () => {
  const request = (host, remoteAddress) => ({ headers: { host }, socket: { remoteAddress } });
  assert.equal(isLocalRequest(request('127.0.0.1:4321', '127.0.0.1')), true);
  assert.equal(isLocalRequest(request('localhost:4321', '::1')), true);
  assert.equal(isLocalRequest(request('example.com', '127.0.0.1')), false);
  assert.equal(isLocalRequest(request('127.0.0.1:4321', '192.168.1.20')), false);
});

test('static build does not publish local editor routes', { skip: !existsSync('dist') && 'run npm run build first' }, () => {
  assert.equal(existsSync('dist/__editor'), false);
});
