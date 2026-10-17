export function validateLink(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.trim() || /[\s<>"'\\\u0000-\u001f]/.test(value) ||
    !/^(?:https?:\/\/|mailto:|tel:|#|[a-zA-Z0-9_./-]+$)/.test(value) || /^(?:javascript|data):/i.test(value)) throw new Error('Ungültige Linkadresse.');
  return value;
}

export function replaceNavigationLink(html,key,href,pageId) {
  validateLink(href);
  if(!/^nav[A-Za-z0-9]+$/.test(key)) throw new Error('Ungültiger Navigationsschlüssel.');
  const value=href.startsWith('#') && pageId!=='index'?'index.html'+href:href;
  let count=0;
  const updated=html.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi,nav=>nav.replace(/<a\b[^>]*>/gi,tag=>{
    if(!tag.includes(`data-i18n="${key}"`))return tag;
    count++;
    return /\bhref="[^"]*"/.test(tag)?tag.replace(/\bhref="[^"]*"/,`href="${value.replace(/&/g,'&amp;')}"`):tag.slice(0,-1)+` href="${value}">`;
  }));
  return {html:updated,count};
}
