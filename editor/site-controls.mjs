const $=selector=>document.querySelector(selector);
export function createSiteControls({getPage,isDirty,request,loadPage,setStatus,pageNavigation}) {
  let state,intent;
  function updateSitePreviewLink() {
    $('#site-preview-link').href='/__editor/site-preview?id='+encodeURIComponent(getPage()?.id || 'index')+'&drafts='+($('#site-preview-drafts').checked?'1':'0');
  }
  $('#site-preview-drafts').addEventListener('change',updateSitePreviewLink);
  const labels=state=>[...state.changes.map(page=>page.title),...(state.translationsChanged?['Gemeinsame DE/EN-Texte']:[]),...(state.eventsChanged?['Eventtexte und Eventdaten']:[])];
  function list(host,values) {host.replaceChildren(...values.map(value=>{const item=document.createElement('li');item.textContent=value;return item;}));}
  async function refreshSiteState() {
    try {
      const response=await fetch('/__editor/api/site');
      if(!response.ok){$('#site-status').textContent='Für Website-Freigaben fehlt die Berechtigung.';return;}
      state=await response.json();
      $('#site-status').textContent=state.changed?'Gespeicherte Änderungen warten auf Freigabe.':'Gespeicherter Stand entspricht der freigegebenen Website.';
      list($('#site-changes'),labels(state));
      $('#site-review').disabled=!state.canReview || !state.changed;
      $('#site-publish').disabled=!state.canPublish || !state.changed || state.reviewedRevision!==state.revision;
      $('#site-withdraw').disabled=!state.canPublish || !state.canWithdraw;
    }catch(error){$('#site-status').textContent=error.message;}
  }
  async function openRelease(action) {
    if(isDirty()){setStatus('Bitte zuerst deine Änderungen speichern. Die Freigabe gilt für gespeicherte Inhalte.');return;}
    await refreshSiteState();if(!state)return;
    intent={action,revision:state.revision,activeRevision:state.activeRevision};
    $('#site-release-title').textContent=action==='review'?'Gespeicherte Website prüfen':action==='withdraw'?'Letzte Website-Freigabe zurücknehmen':'Geprüften Website-Stand freigeben';
    $('#site-release-summary').textContent=action==='review'?'Prüfe die Website-Vorschau mit unfreigegebenen Inhalten. Die Bestätigung gilt exakt für diesen Stand.':action==='withdraw'?'Die gesamte Website kehrt zum vorherigen freigegebenen Stand zurück. Deine aktuellen Entwürfe bleiben erhalten. Kein Build oder Deploy wird ausgeführt.':'Dieser geprüfte Stand wird künftig vom statischen Build verwendet. Es wird nichts übertragen oder deployt.';
    list($('#site-release-changes'),labels(state));
    $('#site-release-confirmed').checked=false;$('#site-release-message').textContent='';$('#site-release-dialog').showModal();
  }
  $('#site-review').addEventListener('click',()=>openRelease('review'));
  $('#site-publish').addEventListener('click',()=>openRelease('publish'));
  $('#site-withdraw').addEventListener('click',()=>openRelease('withdraw'));
  $('#site-release-close').addEventListener('click',()=>$('#site-release-dialog').close());
  async function mutate(body) {
    const response=await request(body),result=await response.json();if(!response.ok)throw Error(result.error);return result;
  }
  $('#site-release-confirm').addEventListener('click',async()=>{
    if(!$('#site-release-confirmed').checked){$('#site-release-message').textContent='Bitte den geprüften Stand ausdrücklich bestätigen.';return;}
    $('#site-release-confirm').disabled=true;
    try {await mutate({...intent,confirm:true});$('#site-release-dialog').close();await refreshSiteState();}
    catch(error){$('#site-release-message').textContent=error.message;}
    finally{$('#site-release-confirm').disabled=false;}
  });
  $('#site-create').addEventListener('click',()=>{
    if(isDirty()){setStatus('Bitte zuerst Änderungen speichern oder verwerfen.');return;}
    $('#site-create-message').textContent='';$('#site-create-dialog').showModal();
  });
  $('#site-create-close').addEventListener('click',()=>$('#site-create-dialog').close());
  $('#site-create-confirm').addEventListener('click',async()=>{
    $('#site-create-confirm').disabled=true;
    try {
      const result=await mutate({action:'create',slug:$('#site-slug').value,type:$('#site-type').value,values:{de:$('#site-title-de').value,en:$('#site-title-en').value},summary:{de:$('#site-summary-de').value,en:$('#site-summary-en').value},navigation:$('#site-in-navigation').checked});
      const pages=await (await fetch('/__editor/api/pages')).json();pageNavigation.setEntries(pages.pages,result.page.id);
      $('#site-create-dialog').close();await loadPage(result.page.id);
    }catch(error){$('#site-create-message').textContent=error.message;}
    finally{$('#site-create-confirm').disabled=false;}
  });
  return {refreshSiteState,updateSitePreviewLink};
}
