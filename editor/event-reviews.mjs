import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { eventText, eventTextFields } from '../shared/event-content.mjs';

const hash = text => createHash('sha256').update(text || '').digest('hex');
export const reviewFile = root => path.join(root, 'editor/event-reviews.json');
export async function readReviews(root) {
  try { return JSON.parse(await readFile(reviewFile(root), 'utf8')); }
  catch(error) { if(error.code === 'ENOENT') return {}; throw error; }
}
export async function writeReviews(root, source) {
  const file=reviewFile(root);
  if((await lstat(file)).isSymbolicLink())throw new Error('Verknüpfte Prüfdatei ist nicht erlaubt.');
  const temporary=path.join(root,'editor','.'+randomUUID()+'.tmp');
  try { await writeFile(temporary,source,{flag:'wx'}); await rename(temporary,file); }
  finally { await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;}); }
}
export function reviewStatus(values, record) {
  if(!values.de?.trim() || !values.en?.trim()) return 'missing';
  if(!record) return 'unreviewed';
  if(record.source !== hash(values.de)) return 'outdated';
  if(!record.target) return 'unreviewed';
  return record.target === hash(values.en) ? 'reviewed' : 'changed';
}
export function describeReviews(data, records) {
  const result = {};
  for(const event of data.events) for(const field of [...eventTextFields, ...Object.keys(event.content || {}).map(key=>'content.'+key)]) {
    const values=eventText(event,field), key=event.id+'/'+field;
    result[key] = { status:reviewStatus(values,records[key]), record:records[key] || null };
  }
  return result;
}
export function applyReviews(data, records, drafts, originalData=data) {
  const result=structuredClone(records);
  for(const draft of drafts) {
    if(draft.review === undefined) continue;
    const originalEvent=originalData.events.find(event=>event.id===draft.id);
    const originalValues=originalEvent && eventText(originalEvent,draft.field);
    const values=eventText(data.events.find(event=>event.id===draft.id),draft.field);
    if(!draft.review || !originalValues || draft.review.expectedSource !== originalValues.de || draft.review.expectedTarget !== originalValues.en || draft.review.source !== values.de || draft.review.target !== values.en || !values.de.trim() || !values.en.trim())
      throw new Error('Übersetzungsprüfung passt nicht zum aktuellen Textstand. Bitte erneut prüfen.');
    result[draft.id+'/'+draft.field]={source:hash(values.de),target:hash(values.en)};
  }
  return result;
}
