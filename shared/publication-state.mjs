import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const revisionOf=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const publicationFile=root=>path.join(root,'content/site-publication.json');
export function readPublication(root) {
  const state=JSON.parse(readFileSync(publicationFile(root),'utf8'));
  if(state.schemaVersion!==1 || !state.active?.snapshot || revisionOf(state.active.snapshot)!==state.active.revision)throw Error('Ungültiger freigegebener Website-Stand.');
  return state;
}
