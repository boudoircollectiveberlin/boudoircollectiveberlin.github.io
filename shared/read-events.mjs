import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { publicEventCatalog } from './event-content.mjs';

export async function readEventCatalog(root) {
  const catalog=publicEventCatalog(JSON.parse(await readFile(path.join(root,'data/events.json'),'utf8')));
  return {...catalog,revision:createHash('sha256').update(JSON.stringify(catalog)).digest('hex')};
}
