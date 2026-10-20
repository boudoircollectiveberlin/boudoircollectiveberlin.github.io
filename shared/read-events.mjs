import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { publicEventCatalog } from './event-content.mjs';
import { readPublication } from './publication-state.mjs';

export async function readEventCatalog(root,{draft=false}={}) {
  const catalog=draft?publicEventCatalog(JSON.parse(await readFile(path.join(root,'data/events.json'),'utf8'))):readPublication(root).active.snapshot.events;
  return {...catalog,revision:createHash('sha256').update(JSON.stringify(catalog)).digest('hex')};
}
