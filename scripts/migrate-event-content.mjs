// One-time, idempotent migration of existing editorial event strings. No inferred facts.
import { readFile, writeFile } from 'node:fs/promises';
import { readTranslations } from '../editor/local-translations.mjs';
import { publicEventCatalog } from '../shared/event-content.mjs';

let source=await readFile('i18n.js','utf8');
const translations=readTranslations(source);
const catalog=JSON.parse(await readFile('data/events.json','utf8'));
const migrated=new Set();
for(const [prefix,id] of [['grabowsee','heilstaette-grabowsee-2026-07-04'],['wrodow','schloss-wrodow-2026-08-08']]){
  const event=catalog.events.find(event=>event.id===id);
  event.detailPage=`event-${prefix}.html`;event.content ||= {};
  function field(key){
    if(!key.startsWith(prefix) || /^(LoginRequired|ProfileRequired)/.test(key.slice(prefix.length)))return null;
    const suffix=key.slice(prefix.length);
    const mapped={HeroTitle:'title',CostValue:'cost'}[suffix];
    if(!mapped && !event.content[suffix]){
      if(!Object.hasOwn(translations.de,key) || !Object.hasOwn(translations.en,key))throw new Error(`Missing source ${key}`);
      event.content[suffix]={de:translations.de[key],en:translations.en[key]};
    }
    migrated.add(key);return mapped || `content.${suffix}`;
  }
  function transform(html){
    html=html.replace(/data-i18n="([^"]+)"/g,(match,key)=>{const value=field(key);return value?`data-event-id="${id}" data-event-field="${value}"`:match;});
    html=html.replace(/<([a-z][\w-]*)\b([^>]*\bdata-event-field="[^"]+"[^>]*)>/gi,(match,tag,attrs)=>`<${tag}${attrs.replace('data-i18n-html=','data-event-html=')}>`);
    html=html.replace(/data-i18n-attrs="([^"]+)"/g,(match,mappings)=>{
      const old=[],next=[];
      for(const entry of mappings.split('|')){const [attribute,key]=entry.split(':');const mapped=field(key);if(mapped)next.push(`${attribute}:${mapped}`);else old.push(entry);}
      return (old.length?`data-i18n-attrs="${old.join('|')}" `:'')+(next.length?`data-event-id="${id}" data-event-attrs="${next.join('|')}"`:'');
    });
    if(prefix==='grabowsee')html=html.replace(/<span>voraussichtlich 25&nbsp;EUR pro Person<\/span>/,'<span data-event-id="'+id+'" data-event-field="cost">voraussichtlich 25&nbsp;EUR pro Person</span>');
    return html;
  }
  for(const file of [`event-${prefix}.html`,`src/content/pages/event-${prefix}.html`]){
    await writeFile(file,transform(await readFile(file,'utf8')));
  }
  const page=`src/pages/event-${prefix}.astro`;
  let astro=await readFile(page,'utf8');
  const match=/const meta = (\{[\s\S]*?\n\});/.exec(astro);
  if(!match)throw new Error('Missing page metadata');
  const meta=JSON.parse(match[1]);meta.head=meta.head.map(transform);
  astro=astro.slice(0,match.index)+`const meta = ${JSON.stringify(meta,null,2)};`+astro.slice(match.index+match[0].length);
  await writeFile(page,astro);
}
// Keep operational UI/error messages in i18n.js; remove only migrated editorial keys.
source=source.split(/(?<=\n)/).filter(line=>{const match=/^\s*([A-Za-z0-9]+):/.exec(line);return !match || !migrated.has(match[1]);}).join('');
readTranslations(source);
catalog.schemaVersion=1;
publicEventCatalog(catalog);
await writeFile('data/events.json',JSON.stringify(catalog,null,2)+'\n');
await writeFile('i18n.js',source);
console.log(`Migrated ${migrated.size} editorial keys into event content.`);
