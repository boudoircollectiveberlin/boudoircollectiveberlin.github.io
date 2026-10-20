import { renderEventCard, applyEventBindings } from './event-content.mjs';
const editLink=document.createElement('a');
const editURL=new URL('/__editor/',location.origin);
editURL.searchParams.set('page',new URL(location.href).searchParams.get('id') || 'index');
editLink.href=editURL.href;
editLink.textContent='Im Editor bearbeiten';
editLink.style.cssText='display:inline-block;margin-right:18px;padding:8px 14px;background:#211f1d;color:#fff;text-decoration:none;border-radius:4px;font-weight:600';
document.querySelector('body > aside[role="status"]')?.prepend(editLink);
const catalog=JSON.parse(document.getElementById('bcb-event-catalog').textContent);
function localize() {
  const locale=localStorage.getItem('bcb-language')==='en'?'en':'de';
  for(const [id,past] of [['upcoming-event-grid',false],['past-event-grid',true]]) {
    const host=document.getElementById(id);
    if(host)host.innerHTML=catalog.events.filter(event=>(event.group==='past')===past).map(event=>renderEventCard(event,{locale})).join('');
  }
  applyEventBindings(document,catalog,{locale});
}
window.addEventListener('bcb:languagechange',localize);
localize();
document.querySelectorAll('form').forEach(form=>{
  form.addEventListener('submit',event=>event.preventDefault());
  form.querySelectorAll('button,input,textarea,select').forEach(control=>control.disabled=true);
});
document.querySelector('[data-menu-toggle]')?.addEventListener('click',event=>{
  const toggle=event.currentTarget,open=toggle.getAttribute('aria-expanded')!=='true';
  toggle.setAttribute('aria-expanded',String(open));document.querySelector('[data-menu]')?.classList.toggle('is-open',open);
});
document.addEventListener('click',event=>{
  const link=event.target.closest('a');if(!link)return;
  const url=new URL(link.href);
  if(url.origin!==location.origin || !/\.html$/.test(url.pathname))return;
  event.preventDefault();
  const id=url.pathname.split('/').pop().replace(/\.html$/,'');
  location.href='/__editor/site-preview?id='+encodeURIComponent(id)+'&drafts='+document.body.dataset.previewDrafts+url.hash;
});
