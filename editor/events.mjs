import { lstat, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { eventText, setEventText, safeEventRichText, publicEventCatalog } from '../shared/event-content.mjs';
import { readPublication } from '../shared/publication-state.mjs';

export function updateEventField(data, { id, field, values }) {
  const event = data.events.find(item => item.id === id);
  if (!event || typeof field!=='string' || !eventText(event,field) || !values ||
    Object.keys(values).some(locale => !['de','en'].includes(locale)) ||
    ['de','en'].some(locale => typeof values[locale] !== 'string' || values[locale].length > 16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(values[locale])) ||
    typeof eventText(event,field) !== 'object') throw new Error('Ungültiges Eventfeld.');
  for(const value of Object.values(values))safeEventRichText(value);
  const copy = structuredClone(data);
  setEventText(copy.events.find(item=>item.id===id),field,{...eventText(event,field),...values});
  return copy;
}

export function applyEventDrafts(data, drafts=[]) {
  if(!Array.isArray(drafts) || drafts.length>500)throw new Error('Ungültige Evententwürfe.');
  return drafts.reduce((result,draft)=>updateEventField(result,draft),data);
}

export async function writeEventSource(root, source) {
  publicEventCatalog(JSON.parse(source));
  const file=path.join(root,'data/events.json');
  if((await lstat(file)).isSymbolicLink())throw new Error('Verknüpfte Eventdatei ist nicht erlaubt.');
  const temporary=path.join(root,'data','.'+randomUUID()+'.tmp');
  try{await writeFile(temporary,source,{flag:'wx'});await rename(temporary,file);}
  finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  await writeFile(path.join(root,'public/data/events.json'),JSON.stringify(readPublication(root).active.snapshot.events,null,2)+'\n');
}
