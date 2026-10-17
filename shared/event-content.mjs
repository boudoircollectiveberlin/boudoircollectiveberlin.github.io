export const eventLocales = Object.freeze(['de','en']);
export const eventTextFields = Object.freeze(['title','summary','format','cost','location','dateLabel','timeLabel']);
export const eventContentFields = Object.freeze('AltBreach AltCorridor AltDoor AltNale1 AltNale2 AltOlaf1 AltOlaf2 AltPiano AltSommer AltSpartan ApplicationCopy ApplicationEyebrow ApplicationTitle Attribution CaptionBreach CaptionCorridor CaptionDoor CaptionOwn CaptionPiano CaptionSommer CaptionSpartan CostLabel FlowCopy FlowEyebrow FlowLabel FlowTitle FlowValue FooterLicense HeroCopy HeroEyebrow HeroPrimary HeroSecondary InviteAdd InviteEmailLabel InviteEmailPlaceholder InviteFunctionLabel InviteFunctionPlaceholder InviteListTitle InviteNoticeCopy InviteRemove MetaDescription OgDescription OgTitle PageTitle ProfileAutoCopy ReferenceCopy ReferenceEyebrow ReferenceNoteCopy ReferenceNoteTitle ReferenceTitle SetupLabel SetupValue Step1Copy Step1Title Step2Copy Step2Title Step3Copy Step3Title'.split(' '));
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
export const escapeEventHtml=value=>String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

export function eventText(event,field) {
  if(eventTextFields.includes(field))return event[field];
  if(typeof field==='string' && field.startsWith('content.') && eventContentFields.includes(field.slice(8)) && own(event.content || {},field.slice(8)))return event.content[field.slice(8)];
  return undefined;
}

export function setEventText(event,field,value) {
  if(!eventText(event,field))throw new Error('Unbekanntes Eventtextfeld.');
  if(field.startsWith('content.'))event.content[field.slice(8)]=value;
  else event[field]=value;
}

export function localizeEvent(value,locale='de') {
  const ownValue=typeof value?.[locale]==='string'?value[locale]:'';
  const other=locale==='de'?'en':'de';
  return ownValue.trim()?ownValue:(value?.[other] || '');
}

export function safeEventRichText(html) {
  // Existing event rich copy consists of text and attribution links. No executable markup.
  if(/<(?!\/?(?:a|strong|em|b|i|br|p|ul|ol|li)\b)|\s(?:on\w+|style|srcdoc)\s*=|(?:javascript|data|vbscript)\s*:/i.test(html))throw new Error('Nicht erlaubtes HTML im Eventtext.');
  for(const match of html.matchAll(/<\/?([a-z]+)\b([^>]*)>/gi)){
    let attributes=match[2].replace(/\/$/,'');
    attributes=attributes.replace(/\s+([a-z-]+)\s*=\s*("[^"]*"|'[^']*')/gi,(attribute,name,quoted)=>{
      if(match[1].toLowerCase()!=='a' || !['href','target','rel'].includes(name.toLowerCase()))throw new Error('Nicht erlaubtes Eventtextattribut.');
      if(name.toLowerCase()==='href'){
        const value=quoted.slice(1,-1).replace(/&#x([a-f0-9]+);?/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#([0-9]+);?/g,(_,number)=>String.fromCodePoint(Number(number))).replace(/&colon;/gi,':').replace(/&(?:Tab|NewLine);/gi,'');
        if(!/^(https?:\/\/|mailto:|#|\/(?!\/))/i.test(value) || /[\u0000-\u0020\\]/.test(value))throw new Error('Nicht erlaubter Link im Eventtext.');
      }
      return '';
    });
    if(attributes.trim())throw new Error('Ungültiges HTML im Eventtext.');
  }
  return html;
}

function localizedPair(value,required=false) {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('DE/EN-Eventtext erwartet.');
  const pair={};
  for(const locale of eventLocales){
    if(typeof value[locale]!=='string' || value[locale].length>16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value[locale]))throw new Error('Ungültiger Eventtext.');
    safeEventRichText(value[locale]);pair[locale]=value[locale];
  }
  if(required && !pair.de.trim() && !pair.en.trim())throw new Error('Eventtitel fehlt.');
  return pair;
}

function assetPath(value) {
  if(typeof value!=='string' || !/^assets\/[a-zA-Z0-9_./%-]+$/.test(value) || value.split('/').includes('..'))throw new Error('Ungültiger Eventbildpfad.');
  return value;
}

export function publicEventCatalog(source) {
  if(!source || !Array.isArray(source.events))throw new Error('Eventkatalog erwartet.');
  const ids=new Set();
  const routes=new Map();
  const events=source.events.map(event=>{
    if(!event || typeof event.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(event.id) || ids.has(event.id))throw new Error('Event-ID fehlt oder ist doppelt.');
    ids.add(event.id);
    if(!['upcoming','past'].includes(event.group) || !['planning','interest','completed'].includes(event.status))throw new Error('Ungültige Eventgruppe oder Status.');
    if(typeof event.type!=='string' || event.type.length>200)throw new Error('Ungültiges Eventformat.');
    const result={id:event.id,group:event.group,status:event.status,type:event.type};
    for(const field of eventTextFields)result[field]=localizedPair(event[field],field==='title');
    for(const field of ['detailUrl','detailPage'])if(event[field]!==undefined){
      if(typeof event[field]!=='string' || !/^[a-z0-9-]+\.html$/.test(event[field]))throw new Error('Ungültige Eventdetailroute.');
      result[field]=event[field];
      if(routes.has(event[field]) && routes.get(event[field])!==event.id)throw new Error('Eventdetailroute ist doppelt.');
      routes.set(event[field],event.id);
    }
    if(event.coverImage)result.coverImage=assetPath(event.coverImage);
    if(event.capacity){
      result.capacity={};
      for(const role of ['photographers','models']){
        const value=event.capacity[role];
        if(value!==null && (!Number.isInteger(value) || value<0))throw new Error('Ungültige öffentliche Kapazität.');
        result.capacity[role]=value;
      }
    }
    if(event.tags){if(!Array.isArray(event.tags) || event.tags.some(tag=>typeof tag!=='string' || tag.length>100))throw new Error('Ungültige Eventtags.');result.tags=[...event.tags];}
    if(event.content){
      result.content={};
      for(const [key,value] of Object.entries(event.content)){
        if(!eventContentFields.includes(key))continue;
        result.content[key]=localizedPair(value);
      }
    }
    return result;
  });
  return {schemaVersion:1,updatedAt:typeof source.updatedAt==='string'?source.updatedAt:'',events};
}

export function eventFieldMarkup(event,field,tag,options={}) {
  const value=localizeEvent(eventText(event,field),options.locale);
  const attrs=`data-event-id="${escapeEventHtml(event.id)}" data-event-field="${escapeEventHtml(field)}"`;
  return `<${tag} ${attrs}>${escapeEventHtml(value)}</${tag}>`;
}

const labels={de:{date:'Datum',location:'Ort',cost:'Kosten',capacity:'Kapazität',photographers:'Fotograf:in',models:'Model',completed:'abgeschlossen',interest:'Interesse offen',planning:'in Planung',details:'Details & Bewerbung'},en:{date:'Date',location:'Location',cost:'Cost',capacity:'Capacity',photographers:'Photographer',models:'Model',completed:'completed',interest:'interest open',planning:'planning',details:'Details & application'}};

export function renderEventCard(event,{locale='de'}={}) {
  const l=labels[locale] || labels.de,esc=escapeEventHtml;
  const text=(field,tag)=>eventFieldMarkup(event,field,tag,{locale});
  const hero=event.group==='upcoming' && event.coverImage;
  if(event.detailUrl && !/^[a-z0-9-]+\.html$/.test(event.detailUrl))throw new Error('Ungültige Eventdetailroute.');
  const top=`<div class="event-card__top"><span class="badge">${esc(event.type)}</span><small class="event-card__status">${l[event.status]}</small></div>`;
  const body=`<div class="event-card__body">${text('title','h3')}<p class="event-card__summary" data-event-id="${esc(event.id)}" data-event-field="summary">${esc(localizeEvent(event.summary,locale))}</p></div>`;
  const date=[text('dateLabel','span'),text('timeLabel','span')].join(' · ');
  const capacity=['photographers','models'].filter(role=>Number.isFinite(event.capacity?.[role])).map(role=>`${event.capacity[role]} ${l[role]}`).join(' / ');
  const meta=`<li><span>${l.date}</span><strong>${date}</strong></li><li><span>${l.location}</span><strong>${text('location','span')}</strong></li><li><span>${l.cost}</span><strong>${text('cost','span')}</strong></li>${capacity?`<li><span>${l.capacity}</span><strong>${esc(capacity)}</strong></li>`:''}`;
  return `<article class="event-card${hero?' event-card--hero':''}" data-event-card="${esc(event.id)}">${hero?`<div class="event-card__hero" style="--event-card-image: url('${assetPath(event.coverImage)}')"><div class="event-card__hero-content">${top}${body}</div></div>`:top+body}<div class="event-card__content"><p class="event-card__format" data-event-id="${esc(event.id)}" data-event-field="format">${esc(localizeEvent(event.format,locale))}</p><ul class="event-card__meta">${meta}</ul>${event.detailUrl?`<a class="button button--ghost event-card__link" href="${esc(event.detailUrl)}">${l.details}</a>`:''}</div></article>`;
}

export function eventForPage(catalog,page) {
  return catalog.events.find(event=>event.detailPage===page || event.detailUrl===page);
}

export function renderEventPage(html,catalog,{locale='de',page=''}={}) {
  const current=eventForPage(catalog,page);
  html=html.replace(/<div\b([^>]*\bid="(upcoming-event-grid|past-event-grid)"[^>]*)>[\s\S]*?<\/div>/g,(match,attrs,id)=>`<div${attrs}>${catalog.events.filter(event=>id==='past-event-grid'?event.group==='past':event.group!=='past').map(event=>renderEventCard(event,{locale})).join('')}</div>`);
  if(!current)return html;
  html=html.replace(/<([a-z][\w-]*)\b([^>]*\bdata-event-field="([^"]+)"[^>]*)>[\s\S]*?<\/\1>/gi,(match,tag,attrs,field)=>{
    const value=eventText(current,field);if(!value)throw new Error(`Unbekanntes Eventfeld ${field}`);
    const text=localizeEvent(value,locale);
    return `<${tag}${attrs}>${/data-event-html="true"/.test(attrs)?safeEventRichText(text):escapeEventHtml(text)}</${tag}>`;
  });
  return html.replace(/<([a-z][\w-]*)\b([^>]*\bdata-event-attrs="([^"]+)"[^>]*)>/gi,(match,tag,attrs,mappings)=>{
    for(const mapping of mappings.split('|')){
      const [attribute,field]=mapping.split(':');
      if(!['alt','content','placeholder','aria-label','title'].includes(attribute))throw new Error('Nicht unterstütztes Eventattribut.');
      const value=escapeEventHtml(localizeEvent(eventText(current,field),locale));
      const expression=new RegExp(`\\s${attribute}="[^"]*"`,'g');attrs=attrs.replace(expression,'');attrs+=` ${attribute}="${value}"`;
    }
    return `<${tag}${attrs}>`;
  });
}

export const serializeEventCatalog=catalog=>JSON.stringify(catalog).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');

export function applyEventBindings(doc,catalog,{locale='de',onField=()=>{}}={}) {
  const byId=new Map(catalog.events.map(event=>[event.id,event]));
  doc.querySelectorAll('[data-event-id][data-event-field]').forEach(node=>{
    const event=byId.get(node.dataset.eventId),field=node.dataset.eventField;
    if(!event || !eventText(event,field))return;
    const value=localizeEvent(eventText(event,field),locale);
    if(node.dataset.eventHtml==='true')node.innerHTML=safeEventRichText(value);
    else node.textContent=value;
    onField(node,event,field);
  });
  doc.querySelectorAll('[data-event-id][data-event-attrs]').forEach(node=>{
    const event=byId.get(node.dataset.eventId);if(!event)return;
    for(const mapping of node.dataset.eventAttrs.split('|')){
      const [attribute,field]=mapping.split(':');
      if(['alt','content','placeholder','aria-label','title'].includes(attribute))node.setAttribute(attribute,localizeEvent(eventText(event,field),locale));
    }
  });
}
