import { renderEventCard, eventText, setEventText, applyEventBindings, safeEventRichText } from './event-content.mjs';
import { createHistory } from './history.mjs';
import { insertionAllowed, localizedValue, missingOtherLanguage } from './content-model.mjs';
import { sectionLayouts } from './section-layouts.mjs';
import { createPageNavigation } from './page-navigation.mjs';
import { createSiteControls } from './site-controls.mjs';

const $ = (selector) => document.querySelector(selector);
const pageSelect = $('#page');
const canvas = $('#canvas');
const saveButton = $('#save');
const undoButton = $('#undo');
const redoButton = $('#redo');
const status = $('#status');
const frame = $('.canvas-frame');
const outline = $('#outline');
const localeSelect = $('#locale');
const keySelect = $('#key');
const translationValue = $('#value');
const translationSaveButton = $('#save-translation');
let token;
let page;
let savedHtml = '';
let savedSnapshot = '';
let pageHistory = createHistory('');
let editTimer;
let selectedKey = '';
let translations;
let selectedLocale = 'de';
let selectedTranslationKey = '';
let translationDirty = false;
let mediaAssets = [];
let selectedImage;
let previewMode = false;
let activeTab = 'structure';
const collapsedNodes = new Set();
let editingLocale = 'de';
let translationDrafts = {de:{},en:{}};
let sourceFragments = new WeakMap();
let sourceAttributes = new WeakMap();
let activeInlineNode;
let insertionAnchor;
let draggedComponent = '';
let eventRecords = [];
let eventReviewStates = {};
let eventReviewBaselines = {};
let eventDrafts = {};
let siteRevision;
const pageNavigation=createPageNavigation();
const {refreshSiteState,updateSitePreviewLink}=createSiteControls({getPage:()=>page,isDirty,loadPage,setStatus,pageNavigation,
  request:body=>editorFetch('/__editor/api/site-action',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify(body)})});
async function editorFetch(url,options) {
  const body=JSON.parse(options.body);
  const response=await fetch(url,{...options,body:JSON.stringify({revision:siteRevision,...body})});
  if(response.ok) {const result=await response.clone().json();if(result.revision)siteRevision=result.revision;}
  return response;
}

function setStatus(message) {
  status.textContent = message;
}

function body() {
  return canvas.contentDocument?.body;
}

function snapshot() {
  const source = body();
  if (!source) return savedSnapshot;
  const copy = source.cloneNode(true);
  const originalAttributeNodes=[...source.querySelectorAll('[data-lang],[data-i18n-placeholder],[data-i18n-attrs],[data-event-attrs]')];
  const clonedAttributeNodes=[...copy.querySelectorAll('[data-lang],[data-i18n-placeholder],[data-i18n-attrs],[data-event-attrs]')];
  originalAttributeNodes.forEach((node,index)=>{
    for(const [attribute,value] of Object.entries(sourceAttributes.get(node) || {})){
      if(value===null)clonedAttributeNodes[index].removeAttribute(attribute);else clonedAttributeNodes[index].setAttribute(attribute,value);
    }
  });
  const originals=[...source.querySelectorAll('[data-i18n],[data-event-field]')];
  const clones=[...copy.querySelectorAll('[data-i18n],[data-event-field]')];
  originals.forEach((node,index)=>{if(sourceFragments.has(node))clones[index].innerHTML=sourceFragments.get(node);});
  copy.removeAttribute('contenteditable');
  copy.querySelectorAll('[data-editor-translated]').forEach(node => {node.removeAttribute('contenteditable');node.removeAttribute('data-editor-translated');});
  copy.querySelectorAll('[data-editor-event-host]').forEach(node => { node.innerHTML = ''; node.removeAttribute('data-editor-event-host'); node.removeAttribute('contenteditable'); });
  copy.querySelectorAll('[data-editor-key]').forEach((node) => node.removeAttribute('data-editor-key'));
  copy.querySelectorAll('.bcb-editor-selected').forEach((node) => node.classList.remove('bcb-editor-selected'));
  copy.querySelectorAll('[data-editor-editable]').forEach(node=>node.removeAttribute('contenteditable'));
  copy.querySelectorAll('*').forEach(node=>[...node.attributes].forEach(attribute=>{if(attribute.name.startsWith('data-editor-'))node.removeAttribute(attribute.name);}));
  copy.querySelectorAll('[class=""]').forEach(node=>node.removeAttribute('class'));
  return copy.innerHTML;
}

function isDirty() {
  return snapshot() !== savedSnapshot || translationDirty || hasTranslationDrafts() || Object.keys(eventDrafts).length>0;
}

function updateToolbar() {
  saveButton.disabled = snapshot() === savedSnapshot && !hasTranslationDrafts() && !translationDirty && !Object.keys(eventDrafts).length;
  undoButton.disabled = !pageHistory.canUndo || previewMode;
  redoButton.disabled = !pageHistory.canRedo || previewMode;
  $('#preview').setAttribute('aria-pressed', String(previewMode));
  $('#preview span').textContent = previewMode ? 'Bearbeiten' : 'Vorschau';
}

function updateStatus() {
  updateToolbar();
  if (translationDirty && activeTab === 'translations') {
    setStatus('Ungespeicherte Übersetzungsänderung');
    return;
  }
  setStatus(`${page?.title || 'Editor'} · ${isDirty() ? 'Ungespeicherte Änderungen' : 'Gespeichert'}`);
}

function documentFor(html) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${location.origin}/"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/__editor/preview.css"></head><body>${html}</body></html>`;
}

function outlineTargets() {
  const doc = canvas.contentDocument;
  if (!doc) return [];
  const targets = [];
  function visit(parent, depth = 0, path = 'node') {
    [...parent.children].forEach((node, index) => {
      if (node.matches('script,style,svg,option,br')) return;
      const key = path + '-' + index;
      const eventHost = node.matches('[data-editor-event-host]');
      const insideEventHost = Boolean(node.closest('[data-editor-event-host]')) && !eventHost;
      const target = !insideEventHost && (node.tagName === 'MAIN' || node.matches('section,article,[data-bcb-layout]') || eventHost);
      if (target) {
        node.dataset.editorKey = key;
        const heading = node.matches('h1,h2,h3') ? node : node.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > .section__heading h1,:scope > .section__heading h2,:scope > .section__heading h3');
        const kind = eventHost ? 'Eventbereich' : node.tagName === 'MAIN' ? 'Seiteninhalt' : 'Abschnitt';
        const label = (node.id === 'upcoming-event-grid' ? 'Kommende Events · gemeinsame Eventdaten' : node.id === 'past-event-grid' ? 'Vergangene Events / Archiv · gemeinsame Eventdaten' : '') || node.getAttribute('aria-label') || heading?.textContent.trim() || node.id || node.textContent.trim() || node.tagName.toLowerCase();
        targets.push({key, node, label: kind + ' · ' + label.replace(/\s+/g, ' ').slice(0,85), level: depth});
      }
      visit(node, depth + (target ? 1 : 0), target ? key : path);
    });
  }
  visit(doc.body);
  return targets;
}

function renderOutline() {
  const targets = outlineTargets();
  $('#outline-count').textContent = `${targets.length}`;
  if (!targets.length) {
    outline.innerHTML = '<p class="hint">Für diese Seite wurden keine Abschnitte erkannt.</p>';
    return;
  }
  const list = document.createElement('ol');
  list.className = 'outline-list';
  targets.forEach(({ key, node, label, level }, index) => {
    if(targets.some(parent => collapsedNodes.has(parent.key) && parent.node !== node && parent.node.contains(node)))return;
    const item = document.createElement('li');
    item.className = "outline-item";
    item.style.paddingLeft = `${level * 12}px`;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.selectKey = key;
    button.setAttribute('aria-current', String(key === selectedKey));
    const number = document.createElement('span');
    number.className = 'outline-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const text = document.createElement('span');
    text.className = 'outline-label';
    text.textContent = label;
    button.append(number, text);
    if(node.children.length && !node.matches('img,input,textarea,select')) {
      const toggle=document.createElement('button');toggle.type='button';toggle.className='outline-toggle';toggle.dataset.collapseKey=key;
      toggle.setAttribute('aria-expanded',String(!collapsedNodes.has(key)));toggle.setAttribute('aria-label',(collapsedNodes.has(key)?'Aufklappen: ':'Zuklappen: ')+label);toggle.textContent=collapsedNodes.has(key)?'▸':'▾';item.append(toggle);
    }
    item.append(button);
    list.append(item);
  });
  outline.replaceChildren(list);
  updateSelectionControls();
}

function selectedNode() {
  return canvas.contentDocument?.querySelector(`[data-editor-key="${CSS.escape(selectedKey)}"]`);
}

function updateSelectionControls() {
  const node = selectedNode();
  const generated = Boolean(node?.closest('[data-editor-event-host]'));
  const sections = node ? structuralSiblings(node) : [];
  const index = sections.indexOf(node);
  updateInsertionControls();
  $('#move-up').disabled = previewMode || generated || index <= 0;
  $('#move-down').disabled = previewMode || generated || index < 0 || index >= sections.length - 1;
  $('#duplicate').disabled = previewMode || generated || index < 0 || Boolean(node?.querySelector('form,[data-editor-event-host]'));
  $('#delete').disabled = previewMode || generated || index < 0;
}

function selectOutline(key, focus = false) {
  const doc = canvas.contentDocument;
  if (!doc) return;
  doc.querySelectorAll('.bcb-editor-selected').forEach((node) => node.classList.remove('bcb-editor-selected'));
  const node = doc.querySelector(`[data-editor-key="${CSS.escape(key)}"]`);
  if (!node) return;
  selectedKey = key;
  node.classList.add('bcb-editor-selected');
  for(const target of outlineTargets())if(target.node!==node && target.node.contains(node))collapsedNodes.delete(target.key);
  if (focus) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showProperties(node);
  $('#selection-title').textContent = node.querySelector('h1,h2,h3')?.textContent.trim() || node.tagName.toLowerCase();
  $('#selection-description').textContent = `Abschnitt · ${node.tagName.toLowerCase()}${node.id ? ` · #${node.id}` : ''}. Doppelklick zum Bearbeiten in der gewählten Sprache.`;
  $('#focus-selection').disabled = previewMode;
  updateInsertionControls();
  renderOutline();
  updateSelectionControls();
  if (focus) {
    setTab('properties');
    node.focus({ preventScroll: true });
  }
}

function setTab(name, focus = false) {
  activeTab = name;
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  document.querySelectorAll('[role=tabpanel]').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
}

function updateHistory() {
  clearTimeout(editTimer);
  const current = snapshot();
  pageHistory.push(captureHistory());
  renderMissingResources();
  renderOutline();
  updateStatus();
}

function recordChange() {
  clearTimeout(editTimer);
  pageHistory.push(captureHistory());
  renderOutline();
  updateStatus();
}

function applyHistory(value) {
  if (value === undefined || !body()) return;
  activeInlineNode=undefined;
  const state=JSON.parse(value);
  translationDrafts=state.drafts;
  eventDrafts=state.events || {};
  sourceFragments=new WeakMap();sourceAttributes=new WeakMap();
  body().innerHTML = state.html;
  lockTranslatedText();
  renderOutline();
  if (selectedKey && !body().querySelector(`[data-editor-key="${CSS.escape(selectedKey)}"]`))
    selectedKey = body().querySelector('main[data-editor-key]')?.dataset.editorKey || '';
  if (selectedKey) selectOutline(selectedKey);
  loadEventPreview();
  updateStatus();
}

function stepHistory(direction) {
  clearTimeout(editTimer);
  const current = snapshot();
  pageHistory.push(captureHistory());
  applyHistory(direction === 'undo' ? pageHistory.undo() : pageHistory.redo());
}

function handleEditorKey(event) {
  const command = event.ctrlKey || event.metaKey;
  if (command && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    stepHistory(event.shiftKey ? 'redo' : 'undo');
  } else if (command && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    stepHistory('redo');
  } else if (command && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (!saveButton.disabled) savePage();
  }
}

function installFrameEditing() {
  const doc = canvas.contentDocument;
  const editableBody = doc.body;
  selectedImage = undefined;
  lockTranslatedText();
  editableBody.contentEditable = 'false';
  editableBody.addEventListener('input', (event) => {
    const translated=activeInlineNode || event.target.closest('[data-i18n]');
    if(translated?.dataset.editorEventResource){const resource=eventResource(translated);if(resource){const values={...eventText(resource.event,resource.field),[editingLocale]:translated.dataset.eventHtml==='true'?translated.innerHTML:translated.textContent};setEventText(resource.event,resource.field,values);eventDrafts[translated.dataset.editorEventResource]={id:resource.event.id,field:resource.field,values};markEventNode(translated,values);}}
    if(translated?.dataset.i18n && !translated.closest('[data-editor-event-host]')) {
      stageTranslation(translated.dataset.i18n,editingLocale,translated.dataset.i18nHtml==='true'?translated.innerHTML:translated.textContent);
      markTranslatedNode(translated);
    }
    clearTimeout(editTimer);
    editTimer = setTimeout(updateHistory, 450);
    updateToolbar();
    setStatus('Ungespeicherte Änderungen');
  });
  editableBody.addEventListener('click', (event) => {
    const language=event.target.closest('[data-lang]')?.dataset.lang;
    if(language){event.preventDefault();switchEditingLocale(language);return;}
    if (previewMode) return;
    const image = event.target.closest('img');
    const target = event.target.closest('[data-editor-key]');
    if (image) {
      selectedImage = image;
      $('#media-selection').textContent = image.alt || image.getAttribute('src') || 'Bild ausgewählt';
      setTab('media');
      renderMedia();
    }
    if (target) {
      showProperties(target);
      selectedKey = target.dataset.editorKey;
      doc.querySelectorAll('.bcb-editor-selected').forEach((node) => node.classList.remove('bcb-editor-selected'));
      target.classList.add('bcb-editor-selected');
      $('#selection-title').textContent = target.querySelector('h1,h2,h3')?.textContent.trim() || target.tagName.toLowerCase();
      $('#selection-description').textContent = `Abschnitt · ${target.tagName.toLowerCase()}${target.id ? ` · #${target.id}` : ''}. Text direkt in der Vorschau bearbeiten.`;
      renderOutline();
    }
    const text=event.target.closest('[data-i18n],[data-editor-event-resource]');
    if(text && !text.dataset.editorEventAttribute && text!==activeInlineNode && !text.querySelector('button,input,select,textarea,[data-i18n]'))beginInlineEdit(text);
    if (event.target.closest('a,button,input,select,textarea,form')) event.preventDefault();
  });
  editableBody.addEventListener('dblclick', event => {const node=event.target.closest('[data-i18n],[data-event-field],[data-event-attrs]') || event.target.closest('p,h1,h2,h3,h4,h5,h6,li,a,span');if(!node || previewMode)return;openResourceDialog(node);});
  editableBody.addEventListener('focusout',event=>{if(event.target===activeInlineNode)finishInlineEdit();});
  editableBody.addEventListener('beforeinput',event=>{if(activeInlineNode && event.inputType==='insertParagraph')event.preventDefault();});
  editableBody.addEventListener('paste',event=>{
    if(!activeInlineNode)return;
    event.preventDefault();
    const selection=doc.getSelection();if(!selection.rangeCount)return;
    const range=selection.getRangeAt(0);range.deleteContents();
    const node=doc.createTextNode(event.clipboardData.getData('text/plain'));range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
    activeInlineNode.dispatchEvent(new Event('input',{bubbles:true}));
  });
  installDropTargets(editableBody);
  editableBody.addEventListener('pointerdown',()=>{contextMenu.hidden=true;});
  editableBody.addEventListener('contextmenu', openContextMenu);
  editableBody.addEventListener('keydown', event => { if(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openContextMenu(event); });
  editableBody.addEventListener('submit', (event) => event.preventDefault());
  doc.addEventListener('keydown', handleEditorKey);
  renderOutline();
  if (!selectedKey || !doc.querySelector(`[data-editor-key="${CSS.escape(selectedKey)}"]`))
    selectedKey = doc.querySelector('[data-editor-key]')?.dataset.editorKey || '';
  if (selectedKey) selectOutline(selectedKey);
  pageHistory.reset(captureHistory());
  savedSnapshot = snapshot();
  loadEventPreview();
  updateStatus();
}

function mutateSection(action) {
  const node = selectedNode();
  if (!isStructuralNode(node)) return;
  const parent = node.parentElement;
  const sections = structuralSiblings(node);
  const index = sections.indexOf(node);
  if (action === 'up' && index > 0) parent.insertBefore(node, sections[index - 1]);
  else if (action === 'down' && index >= 0 && index < sections.length - 1) parent.insertBefore(sections[index + 1], node);
  else if (action === 'delete') {
    if (!window.confirm('Diesen Abschnitt mit seinem Inhalt entfernen? Du kannst den Schritt rückgängig machen.')) return;
    node.remove();
    selectedKey = '';
  } else if (action === 'duplicate') {
    if (node.querySelector('form,[data-editor-event-host]')) return;
    const copy = node.cloneNode(true);
    const originalTexts=[...(node.matches('[data-i18n]')?[node]:[]),...node.querySelectorAll('[data-i18n]')];
    const copiedTexts=[...(copy.matches('[data-i18n]')?[copy]:[]),...copy.querySelectorAll('[data-i18n]')];
    const remapped=new Map();
    originalTexts.forEach((original,index)=>{
      const originalKey=original.dataset.i18n;
      if(!remapped.has(originalKey)){
        const key='editor_'+crypto.randomUUID().replaceAll('-','');remapped.set(originalKey,key);
        for(const locale of ['de','en'])stageTranslation(key,locale,draftValue(originalKey,locale) || '');
      }
      sourceFragments.set(copiedTexts[index],sourceFragments.get(original) || original.innerHTML);
      copiedTexts[index].dataset.i18n=remapped.get(originalKey);
    });
    const suffix = `-copy-${Date.now().toString(36)}`;
    const ids = new Map();
    const idNodes = [...(copy.id ? [copy] : []), ...copy.querySelectorAll('[id]')];
    idNodes.forEach((element, itemIndex) => {
      const original = element.id;
      const replacement = `${original}${suffix}-${itemIndex}`;
      ids.set(original, replacement);
      element.id = replacement;
    });
    [copy,...copy.querySelectorAll('*')].forEach((element) => {
      for (const attribute of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls']) {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, value.split(/\s+/).map((id) => ids.get(id) || id).join(' '));
      }
      const href = element.getAttribute('href');
      if (href?.startsWith('#') && ids.has(href.slice(1))) element.setAttribute('href', `#${ids.get(href.slice(1))}`);
    });
    node.after(copy);
  }
  const next = [...parent.children].filter(isStructuralNode);
  renderLocale();
  const selectedIndex = action === 'delete' ? 0 : next.indexOf(node);
  renderOutline();
  const key = selectedIndex >= 0 && next.length ? next[Math.min(selectedIndex, next.length - 1)].dataset.editorKey : '';
  selectedKey = key;
  if (key) selectOutline(key);
  recordChange();
}

async function loadPage(id) {
  const response = await fetch(`/__editor/api/page?id=${encodeURIComponent(id)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Seite konnte nicht geladen werden.');
  page = result.page;
  siteRevision=result.revision;
  pageNavigation.setCurrent(page.id);
  const dictionary=await (await fetch('/__editor/api/translations')).json();
  translations=dictionary.translations;
  renderTranslationKeys();
  savedHtml = result.html;
  selectedKey = '';
  activeInlineNode=undefined;
  sourceFragments=new WeakMap();sourceAttributes=new WeakMap();
  translationDrafts={de:{},en:{}};eventDrafts={};
  collapsedNodes.clear();
  $('#canvas-label').textContent = `${page.title} · ${previewMode ? 'Vorschau' : 'Bearbeiten'}`;
  canvas.onload = installFrameEditing;
  canvas.srcdoc = documentFor(savedHtml);
  refreshSiteState();updateSitePreviewLink();
}

async function savePage() {
  clearTimeout(editTimer);
  finishInlineEdit();
  stagePanelTranslation();
  const html = snapshot();
  const drafts=structuredClone(translationDrafts);
  const events=Object.values(structuredClone(eventDrafts));
  saveButton.disabled = true;
  setStatus('Änderungen werden gespeichert …');
  try {
    const response = await editorFetch('/__editor/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Editor-Token': token },
      body: JSON.stringify({ id: page.id, html, translations:drafts,events }),
    });
    const result = await response.json();
    if (!response.ok) {
      if(response.status===409)openSaveConflict();
      throw new Error(result.error || 'Speichern fehlgeschlagen.');
    }
    savedHtml = html;
    for(const locale of ['de','en'])Object.assign(translations[locale],drafts[locale]);
    for(const locale of ['de','en'])for(const [key,value] of Object.entries(drafts[locale]))if(translationDrafts[locale][key]===value)delete translationDrafts[locale][key];
    translationSaveButton.disabled=!translationDirty;
    for(const event of events)if(JSON.stringify(eventDrafts[event.id+'/'+event.field])===JSON.stringify(event))delete eventDrafts[event.id+'/'+event.field];
    savedSnapshot = html;
    pageHistory.reset(captureHistory());
    await loadEventPreview();
    await refreshSiteState();
    if(page.titleKey){const result=await (await fetch('/__editor/api/pages')).json();pageNavigation.setEntries(result.pages,page.id);page.title=translations.de[page.titleKey] || page.title;}
    updateStatus();
  } catch (error) {
    saveButton.disabled = false;
    setStatus(error.message);
  }
}

function openSaveConflict() {
  $('#conflict-own').srcdoc=documentFor(body().innerHTML.replace(/contenteditable="[^"]*"/g,''));
  $('#conflict-stored').src='/__editor/site-preview?id='+encodeURIComponent(page.id)+'&drafts=1';
  $('#conflict-dialog').showModal();
}
$('#conflict-close').addEventListener('click',()=>$('#conflict-dialog').close());
$('#conflict-download').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({page:page.id,revision:siteRevision,html:snapshot(),translations:translationDrafts,events:Object.values(eventDrafts)},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=page.id+'-entwurf.json';link.click();URL.revokeObjectURL(url);
});
$('#conflict-reload').addEventListener('click',async()=>{
  if(!window.confirm('Eigenen ungespeicherten Entwurf verwerfen und den gespeicherten Stand laden? Sichere ihn bei Bedarf zuerst als Datei.'))return;
  $('#conflict-dialog').close();translationDirty=false;await loadPage(page.id);
});

function loadTranslation() {
  selectedLocale = localeSelect.value;
  selectedTranslationKey = keySelect.value;
  translationValue.value = draftValue(selectedTranslationKey,selectedLocale) || '';
  $('#translation-source').textContent = draftValue(selectedTranslationKey,selectedLocale === 'de' ? 'en' : 'de') || 'Noch keine Übersetzung vorhanden.';
  translationDirty = false;
  translationSaveButton.disabled = true;
}

function renderMedia() {
  const query = $('#media-search').value.trim().toLocaleLowerCase();
  const visible = mediaAssets.filter((asset) => asset.src.toLocaleLowerCase().includes(query));
  $('#media-count').textContent = `${visible.length} / ${mediaAssets.length}`;
  const list = $('#media-list');
  list.replaceChildren();
  if (!selectedImage) {
    $('#media-selection').textContent = 'Kein Bild ausgewählt';
  }
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Keine passenden Bilder gefunden.';
    list.append(empty);
    return;
  }
  visible.forEach((asset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'media-choice';
    button.setAttribute('aria-pressed', String(selectedImage?.getAttribute('src') === asset.src));
    const image = document.createElement('img');
    image.src = `/${asset.src}`;
    image.alt = '';
    image.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = asset.src;
    button.append(image, label);
    button.addEventListener('click', async () => {
      if (!selectedImage || previewMode) {
        setStatus('Wähle zuerst ein Bild in der Vorschau aus.');
        return;
      }
      const image = selectedImage;
      if (!/\.svg$/i.test(asset.src)) {
        button.disabled = true; setStatus('WebP wird vorbereitet …');
        try {
          const response = await editorFetch('/__editor/api/media-prepare', {method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify({src:asset.src})});
          const result=await response.json(); if(!response.ok)throw new Error(result.error);
          if(!image.isConnected)return;
          image.setAttribute('src',result.src);
        } catch(error) {setStatus(error.message);return;} finally {button.disabled=false;}
      } else image.setAttribute('src',asset.src);
      selectedImage = image;
      selectedImage.removeAttribute('srcset');
      selectedImage.removeAttribute('sizes');
      $('#media-selection').textContent = asset.src;
      renderMedia();
      selectedImage.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    });
    list.append(button);
  });
}

async function saveTranslation() {
  stagePanelTranslation();
  await savePage();
  renderTranslationKeys();renderLocale();
}

pageSelect.addEventListener('change', async () => {
  if(!pageSelect.value)return;
  if (isDirty() && !window.confirm('Ungespeicherte Änderungen verwerfen?')) {
    pageSelect.value = page.id;
    return;
  }
  translationDirty = false;
  try {
    await loadPage(pageSelect.value);
  } catch (error) {
    setStatus(error.message);
  }
});

saveButton.addEventListener('click', savePage);
undoButton.addEventListener('click', () => stepHistory('undo'));
redoButton.addEventListener('click', () => stepHistory('redo'));
$('#focus-selection').addEventListener('click', () => {
  selectOutline(selectedKey, true);
});
outline.addEventListener('click', (event) => {
  const toggle=event.target.closest('[data-collapse-key]');
  if(toggle){const key=toggle.dataset.collapseKey;if(collapsedNodes.has(key))collapsedNodes.delete(key);else collapsedNodes.add(key);renderOutline();outline.querySelector(`[data-collapse-key="${CSS.escape(key)}"]`)?.focus();return;}
  const button = event.target.closest('[data-select-key]');
  if (button) selectOutline(button.dataset.selectKey, true);
});
$('#move-up').addEventListener('click', () => mutateSection('up'));
$('#move-down').addEventListener('click', () => mutateSection('down'));
$('#duplicate').addEventListener('click', () => mutateSection('duplicate'));
$('#delete').addEventListener('click', () => mutateSection('delete'));

$('#preview').addEventListener('click', () => {
  clearTimeout(editTimer);
  finishInlineEdit();
  previewMode = !previewMode;
  if (body()) body().contentEditable = 'false';
  frame.classList.toggle('preview-mode', previewMode);
  $('#canvas-label').textContent = `${page?.title || 'Seite'} · ${previewMode ? 'Vorschau' : 'Bearbeiten'}`;
  $('#focus-selection').disabled = previewMode || !selectedKey;
  if (previewMode) canvas.contentDocument.querySelectorAll('.bcb-editor-selected').forEach((node) => node.classList.remove('bcb-editor-selected'));
  else if (selectedKey) selectOutline(selectedKey);
  renderLocale();
  updateSelectionControls();
  updateToolbar();
});

document.querySelectorAll('.device-button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.device-button').forEach((device) => {
    const active = device === button;
    device.classList.toggle('active', active);
    device.setAttribute('aria-pressed', String(active));
  });
  frame.style.width = button.dataset.width;
}));

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => setTab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(tabs.indexOf(button) + offset + tabs.length) % tabs.length];
    setTab(next.dataset.tab, true);
  });

});

localeSelect.addEventListener('change',()=>switchEditingLocale(localeSelect.value));
keySelect.addEventListener('change',()=>{stagePanelTranslation();loadTranslation();});
translationValue.addEventListener('input', () => {
  translationDirty = translationValue.value !== (draftValue(keySelect.value,localeSelect.value) || '');
  translationSaveButton.disabled = !translationDirty;
  updateStatus();
});
translationSaveButton.addEventListener('click', saveTranslation);
document.addEventListener('keydown', (event) => {
  if (event.target.closest('textarea,input,select')) return;
  handleEditorKey(event);
});

Promise.all([
  fetch('/__editor/api/pages').then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Editor konnte nicht geladen werden.');
    token = result.token;
    pageNavigation.setEntries(result.pages,result.pages[0]?.id);
    $('#site-create').disabled=!result.canCreate;
    saveButton.disabled = false;
    undoButton.disabled = false;
    redoButton.disabled = false;
    if(result.pages.length)await loadPage(result.pages[0].id);
  }),
  fetch('/__editor/api/translations').then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Übersetzungen konnten nicht geladen werden.');
    translations = result.translations;
    keySelect.replaceChildren(...[...new Set([...Object.keys(translations.de), ...Object.keys(translations.en)])].filter((key) => key !== 'htmlLang').map((key) => new Option(key, key)));
    keySelect.disabled = false;
    translationValue.disabled = false;
    renderTranslationKeys();renderLocale();
  }),
  fetch('/__editor/api/media').then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Mediathek konnte nicht geladen werden.');
    mediaAssets = result.assets;
    renderMedia();
  }),
]).catch((error) => setStatus(error.message));

$('#media-search').addEventListener('input', renderMedia);
function showProperties(node) {
  const link = node.closest('a');
  $('#link-properties').hidden = !link;
  $('#link-url').value = link?.getAttribute('href') || '';
  $('#shared-link-label').hidden = !link?.closest('nav') || !link?.dataset.i18n;
  const key = node.closest('[data-i18n]')?.getAttribute('data-i18n') || attributeResources(node)[0]?.key;
  $('#edit-selected-translation').disabled = !key || !translations;
  $('#edit-selected-translation').dataset.key = key || '';
}
$('#apply-link').addEventListener('click', async () => {
  const link = selectedNode()?.closest('a'), value = $('#link-url').value.trim();
  if (!link || !/^(?:https?:\/\/|mailto:|tel:|#|[a-zA-Z0-9_./-]+$)/.test(value) || /^(?:javascript|data):/i.test(value)) { setStatus('Bitte eine gültige Linkadresse angeben.'); return; }
  if(!$('#shared-link-label').hidden && $('#shared-link').checked) {
    $('#apply-link').disabled=true;
    try{const response=await editorFetch('/__editor/api/navigation-save',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify({key:link.dataset.i18n,href:value})});const result=await response.json();if(!response.ok)throw new Error(result.error);link.setAttribute('href',value);recordChange();refreshSiteState();setStatus('Navigation auf '+result.count+' Seiten als Entwurf gespeichert.');}catch(error){setStatus(error.message);}finally{$('#apply-link').disabled=false;}
  } else {link.setAttribute('href',value); recordChange();}
});
$('#edit-selected-translation').addEventListener('click', event => {
  stagePanelTranslation();
  $('#translation-filter').value='';$('#translation-missing').checked=false;renderTranslationKeys();
  keySelect.value = event.currentTarget.dataset.key; loadTranslation(); setTab('translations');
});
const contextMenu = $('#context-menu');
function positionContextMenu(x,y) {
  const viewport=window.visualViewport;
  const left=viewport?.offsetLeft || 0,top=viewport?.offsetTop || 0;
  const width=viewport?.width || innerWidth,height=viewport?.height || innerHeight;
  const rect=contextMenu.getBoundingClientRect(),gap=8;
  contextMenu.style.left=Math.max(left+gap,Math.min(left+width-rect.width-gap,x))+'px';
  contextMenu.style.top=Math.max(top+gap,Math.min(top+height-rect.height-gap,y))+'px';
}
function openContextMenu(event) {
  if (previewMode) return;
  const treeKey=event.target.closest('[data-select-key]')?.dataset.selectKey;
  const node = treeKey ? canvas.contentDocument.querySelector(`[data-editor-key="${CSS.escape(treeKey)}"]`) : event.target.closest('[data-editor-key]') || selectedNode();
  if (!node) return;
  event.preventDefault(); selectOutline(node.dataset.editorKey);
  const rect = event.currentTarget===outline?{left:0,top:0}:canvas.getBoundingClientRect();
  $('#context-edit-text').hidden=!resourceEditable(node);
  const firstLayout=sectionLayouts[0]?.id;
  contextMenu.querySelectorAll('[data-insert]').forEach(button=>{button.disabled=!firstLayout || !canInsert(firstLayout,button.dataset.insert,node);});
  contextMenu.querySelectorAll('[data-action]').forEach(button => { button.disabled = $('#'+button.dataset.action).disabled; });
  contextMenu.hidden = false;
  contextMenu.scrollTop=0;
  positionContextMenu(rect.left+event.clientX,rect.top+event.clientY);
  contextMenu.querySelector('button:not(:disabled):not([hidden])')?.focus({preventScroll:true});
}
window.addEventListener('resize',()=>{contextMenu.hidden=true;});
window.visualViewport?.addEventListener('resize',()=>{contextMenu.hidden=true;});
contextMenu.addEventListener('click', event => {
  if(event.target.closest('#context-edit-text'))openResourceDialog(selectedNode());
  const insert=event.target.closest('[data-insert]');
  if(insert && !insert.disabled)openInsertion(insert.dataset.insert);
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) $('#'+button.dataset.action).click();
  contextMenu.hidden=true;
});
contextMenu.addEventListener('keydown', event => {
  const buttons=[...contextMenu.querySelectorAll('button:not(:disabled):not([hidden])')];
  if(event.key==='Escape') {contextMenu.hidden=true;canvas.focus();}
  if(['ArrowDown','ArrowUp'].includes(event.key)) {event.preventDefault();buttons[(buttons.indexOf(document.activeElement)+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
});
document.addEventListener('pointerdown', event => {if(!contextMenu.contains(event.target)) contextMenu.hidden=true;});
window.addEventListener('beforeunload', event => {if(isDirty()) {event.preventDefault();event.returnValue='';}});

let eventGeneration = 0;
async function loadEventPreview() {
  const generation = ++eventGeneration, doc = canvas.contentDocument;
  const hosts = [['upcoming-event-grid','upcoming','Kommende Events'],['past-event-grid','past','Vergangene Events / Archiv']];
  if (!doc || (!doc.getElementById('upcoming-event-grid') && !doc.querySelector('[data-event-id]'))) return;
  for (const [id] of hosts) {
    const host = doc.getElementById(id); if(!host)continue;
    host.dataset.editorEventHost=''; host.contentEditable='false'; host.textContent='Eventdaten werden geladen …';
  }
  try {
    const response=await fetch('/__editor/api/events');
    if(!response.ok)throw new Error('Eventdaten konnten nicht geladen werden.');
    const data=await response.json();
    eventRecords=data.events;
    eventReviewStates=data.reviews || {};
    eventReviewBaselines=Object.fromEntries(data.events.flatMap(event=>Object.keys(eventReviewStates).filter(key=>key.startsWith(event.id+'/')).map(key=>[key,{...eventText(event,key.slice(event.id.length+1))}])));
    for(const draft of Object.values(eventDrafts)){const event=eventRecords.find(item=>item.id===draft.id);if(event)setEventText(event,draft.field,{...draft.values});}
    if(generation!==eventGeneration || doc!==canvas.contentDocument)return;
    for(const [id,group,label] of hosts) {
      const host=doc.getElementById(id); if(!host)continue;
      host.replaceChildren();
      const items=data.events.filter(event => group==='past'?event.group==='past':event.group!=='past');
      if(!items.length)host.textContent=label+': Keine Einträge.';
      host.innerHTML=items.map(event=>renderEventCard(event,{locale:editingLocale})).join('');
      if(!items.length)host.textContent=label+': Keine Einträge.';
    }
    projectEventContent();
    renderOutline();renderMissingResources(); updateStatus();
  } catch(error) {
    if(generation!==eventGeneration)return;
    for(const [id] of hosts) { const host=doc.getElementById(id); if(host) {host.textContent=error.message;const retry=doc.createElement('button');retry.textContent='Erneut laden';retry.addEventListener('click',loadEventPreview);host.append(retry);} }
    renderOutline();
  }
}
function openEventField(event,field) {
  if(previewMode)return;
  const dialog=$('#event-dialog');
  dialog.dataset.id=event.id;dialog.dataset.field=field;
  $('#event-field-title').textContent=(event.title.de||event.id)+' · '+field;
  $('#event-de').value=eventText(event,field).de||'';$('#event-en').value=eventText(event,field).en||'';
  $('#event-message').textContent='Gemeinsamer Eventdatensatz für Liste und Detailseite · Änderungen bleiben bis zum Speichern im Entwurf.';
  $('#event-reviewed').checked=false;
  updateEventReviewStatus();
  dialog.showModal();$('#event-'+editingLocale).focus();
}
function updateEventReviewStatus() {
  const dialog=$('#event-dialog'),key=dialog.dataset.id+'/'+dialog.dataset.field;
  const values={de:$('#event-de').value,en:$('#event-en').value},baseline=eventReviewBaselines[key];
  const draft=eventDrafts[key];
  let status=eventReviewStates[key]?.status || 'unreviewed';
  if(baseline && values.de!==baseline.de)status='outdated';
  else if(baseline && values.en!==baseline.en)status='changed';
  if(draft?.review?.source===values.de && draft?.review?.target===values.en)status='reviewed';
  if(!values.de.trim() || !values.en.trim())status='missing';
  $('#event-review-status').textContent={missing:'Eine Sprachfassung fehlt.',unreviewed:'Vorhandene Übersetzung · noch nicht bestätigt.',outdated:'Deutsch wurde geändert · Englisch bitte prüfen.',changed:'Englisch wurde geändert · Prüfung noch offen.',reviewed:'Englisch für diesen deutschen Textstand geprüft.'}[status];
  $('#event-reviewed').disabled=status==='missing';
}
for(const locale of ['de','en'])$('#event-'+locale).addEventListener('input',()=>{$('#event-reviewed').checked=false;updateEventReviewStatus();});
$('#event-close').addEventListener('click',()=>$('#event-dialog').close());
$('#event-save').addEventListener('click',()=>{
  const dialog=$('#event-dialog'),event=eventRecords.find(item=>item.id===dialog.dataset.id),field=dialog.dataset.field;
  if(!event)return;
  const values={de:$('#event-de').value,en:$('#event-en').value};
  try{for(const value of Object.values(values))safeEventRichText(value);}catch(error){$('#event-message').textContent=error.message;return;}
  const baseline=eventReviewBaselines[event.id+'/'+field];
  setEventText(event,field,values);eventDrafts[event.id+'/'+field]={id:event.id,field,values,...($('#event-reviewed').checked?{review:{source:values.de,target:values.en,expectedSource:baseline?.de,expectedTarget:baseline?.en}}:{})};
  dialog.close();recordChange();loadEventPreview();
});

let newTextAnchor;
$('#new-text').addEventListener('click',()=>{
  newTextAnchor=selectedNode();
  if(previewMode || !newTextAnchor || newTextAnchor.closest('[data-editor-event-host]') || !newTextAnchor.closest('main') || newTextAnchor.closest('form')) {setStatus('Bitte im Seiteninhalt einen Text oder Container auswählen.');return;}
  $('#new-text-message').textContent='';$('#new-text-dialog').showModal();
});
$('#new-text-close').addEventListener('click',()=>$('#new-text-dialog').close());
$('#new-text-create').addEventListener('click',async()=>{
  const values={de:$('#new-text-de').value,en:$('#new-text-en').value};
  const key='editor_'+crypto.randomUUID().replaceAll('-','');
  if(!newTextAnchor?.isConnected)return;
  $('#new-text-create').disabled=true;
  try {
    if(!values.de.trim())throw new Error('Bitte deutschen Quelltext eingeben.');
    const node=canvas.contentDocument.createElement('p');node.dataset.i18n=key;node.textContent=values.de;
    stageTranslation(key,'de',values.de);stageTranslation(key,'en',values.en);
    if(newTextAnchor.matches('main,section,article,div'))newTextAnchor.append(node);else newTextAnchor.after(node);
    lockTranslatedText();recordChange();$('#translation-filter').value='';$('#translation-missing').checked=false;renderTranslationKeys();keySelect.value=key;loadTranslation();
    $('#new-text-dialog').close();$('#new-text-de').value='';$('#new-text-en').value='';setTab('translations');
    setStatus('Text im Entwurf angelegt. Speichern sichert Inhalt und Sprachfassungen gemeinsam.');
  }catch(error){$('#new-text-message').textContent=error.message;}finally{$('#new-text-create').disabled=false;}
});
function renderTranslationKeys() {
  if(!translations)return;
  const query=$('#translation-filter').value.toLocaleLowerCase(),missing=$('#translation-missing').checked;
  const keys=[...new Set([...Object.keys(translations.de),...Object.keys(translations.en),...Object.keys(translationDrafts.de),...Object.keys(translationDrafts.en)])].filter(key=>key!=='htmlLang' && (!missing || missingOtherLanguage(translations,translationDrafts,key,editingLocale)) && [key,draftValue(key,'de'),draftValue(key,'en')].some(value=>value?.toLocaleLowerCase().includes(query)));
  keySelect.replaceChildren(...keys.map(key=>new Option((missingOtherLanguage(translations,translationDrafts,key,editingLocale)?missingOtherLanguage(translations,translationDrafts,key,editingLocale).toUpperCase()+' fehlt · ':'')+(draftValue(key,editingLocale) || draftValue(key,editingLocale==='de'?'en':'de') || key).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,100),key)));
  if(keys.includes(selectedTranslationKey))keySelect.value=selectedTranslationKey;
  if(!translationDirty && keys.length)loadTranslation();
}
for(const id of ['translation-filter','translation-missing'])$('#'+id).addEventListener('input',()=>{
  if(translationDirty){setStatus('Bitte zuerst die geänderte Übersetzung speichern.');return;}renderTranslationKeys();
});

$('#edit-metadata').addEventListener('click',async()=>{
  try{const response=await fetch('/__editor/api/metadata?id='+encodeURIComponent(page.id)+'&locale='+editingLocale);const values=await response.json();if(!response.ok)throw new Error(values.error);$('#meta-title').value=values.title;$('#meta-description').value=values.description;$('#meta-message').textContent='';$('#metadata-dialog').showModal();}catch(error){setStatus(error.message);}
});
$('#meta-close').addEventListener('click',()=>$('#metadata-dialog').close());
$('#meta-save').addEventListener('click',async()=>{
  $('#meta-save').disabled=true;
  try{const response=await editorFetch('/__editor/api/metadata-save',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify({id:page.id,locale:editingLocale,values:{title:$('#meta-title').value,description:$('#meta-description').value}})});const result=await response.json();if(!response.ok)throw new Error(result.error);$('#metadata-dialog').close();refreshSiteState();setStatus('Metadaten als Entwurf gespeichert.');if(page.titleKey && !isDirty())await loadPage(page.id);}catch(error){$('#meta-message').textContent=error.message;}finally{$('#meta-save').disabled=false;}
});

function lockTranslatedText(){renderLocale();}

function hasTranslationDrafts() {
  return Object.keys(translationDrafts.de).length > 0 || Object.keys(translationDrafts.en).length > 0;
}

function captureHistory() {
  return JSON.stringify({html:snapshot(),drafts:translationDrafts,events:eventDrafts});
}

function draftValue(key, locale) {
  return Object.hasOwn(translationDrafts[locale],key) ? translationDrafts[locale][key] : translations?.[locale]?.[key];
}

function stageTranslation(key, locale, value) {
  if (!key || key==='htmlLang') return;
  if (translations?.[locale]?.[key] === value) delete translationDrafts[locale][key];
  else translationDrafts[locale][key]=value;
}

function stagePanelTranslation() {
  if (!translationDirty || !selectedTranslationKey) return;
  stageTranslation(selectedTranslationKey,selectedLocale,translationValue.value);
  translationDirty=false;
  translationSaveButton.disabled=true;
  recordChange();
}

function markTranslatedNode(node) {
  const missing=missingOtherLanguage(translations,translationDrafts,node.dataset.i18n,editingLocale);
  if (missing && !previewMode) node.dataset.editorMissing=missing.toUpperCase()+' fehlt';
  else delete node.dataset.editorMissing;
}

function renderLocale() {
  const doc=canvas.contentDocument;
  if(!doc?.body || !translations)return;
  doc.documentElement.lang=editingLocale;
  doc.body.dataset.editorMode=previewMode?'preview':'edit';
  doc.querySelectorAll('[data-i18n]').forEach(node=>{if(!sourceFragments.has(node))sourceFragments.set(node,node.innerHTML);});
  doc.querySelectorAll('[data-i18n-placeholder],[data-i18n-attrs],[data-lang]').forEach(node=>{
    const original=sourceAttributes.get(node) || {};
    for(const {key,attribute} of attributeResources(node)){
      if(!Object.hasOwn(original,attribute))original[attribute]=node.getAttribute(attribute);
      const value=localizedValue(translations,translationDrafts,key,editingLocale,original[attribute] || '');
      node.setAttribute(attribute,value.text);
      const missing=missingOtherLanguage(translations,translationDrafts,key,editingLocale);
      if(missing && !previewMode)node.dataset.editorMissing=missing.toUpperCase()+' fehlt · '+attribute;
      else if(!node.dataset.i18n)delete node.dataset.editorMissing;
    }
    if(node.dataset.lang){
      if(!Object.hasOwn(original,'aria-pressed'))original['aria-pressed']=node.getAttribute('aria-pressed');
      node.setAttribute('aria-pressed',String(node.dataset.lang===editingLocale));
    }
    sourceAttributes.set(node,original);
  });
  doc.querySelectorAll('[data-i18n]').forEach(node=>{
    if(node.closest('[data-editor-event-host]'))return;
    if(!sourceFragments.has(node))sourceFragments.set(node,node.innerHTML);
    const original=sourceFragments.get(node);
    const value=localizedValue(translations,translationDrafts,node.dataset.i18n,editingLocale,original);
    if(node!==activeInlineNode){
      if(node.dataset.i18nHtml==='true')node.innerHTML=value.text;
      else node.textContent=value.text;
      node.contentEditable='false';node.dataset.editorTranslated='';
    }
    markTranslatedNode(node);
  });
  doc.querySelectorAll('[data-bcb-component]').forEach(node=>{
    if(!node.children.length && !node.textContent.trim())node.dataset.editorEmpty='Leerer Container · Komponente hier einfügen';
    else delete node.dataset.editorEmpty;
  });
  document.querySelectorAll('[data-edit-locale]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editLocale===editingLocale)));
  localeSelect.value=editingLocale;
  $('#canvas-label').textContent=`${page?.title || 'Seite'} · ${editingLocale.toUpperCase()} · ${previewMode?'Vorschau':'Bearbeiten'}`;
  projectEventContent();
  renderMissingResources();
}

function beginInlineEdit(node) {
  if(previewMode || !translations || (node.closest('[data-editor-event-host]') && !node.dataset.editorEventResource))return;
  finishInlineEdit();stagePanelTranslation();
  selectOutline(node.dataset.editorKey);
  activeInlineNode=node;
  node.contentEditable='true';node.dataset.editorEditable='';
  node.focus();
  setStatus(`${editingLocale.toUpperCase()} direkt bearbeiten · Doppelklick öffnet Textdialog · Entwurf mit Speichern sichern`);
}

function finishInlineEdit() {
  if(!activeInlineNode)return;
  const node=activeInlineNode;
  activeInlineNode=undefined;
  node.contentEditable='false';delete node.dataset.editorEditable;
  // No input means a displayed fallback must remain a missing translation.
  recordChange();
  renderLocale();
}

function switchEditingLocale(locale) {
  if(!['de','en'].includes(locale))return;
  finishInlineEdit();stagePanelTranslation();
  editingLocale=locale;
  localeSelect.value=locale;
  renderLocale();renderTranslationKeys();loadTranslation();
  loadEventPreview();renderOutline();updateStatus();
}

document.querySelectorAll('[data-edit-locale]').forEach(button=>button.addEventListener('click',()=>switchEditingLocale(button.dataset.editLocale)));
$('#missing-summary').addEventListener('click',()=>{
  const panel=$('#missing-resources');panel.hidden=!panel.hidden;
  $('#missing-summary').setAttribute('aria-expanded',String(!panel.hidden));
});

function renderMissingResources() {
  const doc=canvas.contentDocument;
  if(!doc?.body || !translations)return;
  const missing=new Map();
  doc.querySelectorAll('[data-i18n]').forEach(node=>{
    const missingLanguage=missingOtherLanguage(translations,translationDrafts,node.dataset.i18n,editingLocale);
    if(missingLanguage)missing.set(node.dataset.i18n,{node,label:(node.textContent || node.dataset.i18n).trim().slice(0,90)});
  });
  doc.querySelectorAll('[data-i18n-placeholder],[data-i18n-attrs]').forEach(node=>{
    for(const {key,attribute} of attributeResources(node)){
      if(missingOtherLanguage(translations,translationDrafts,key,editingLocale))missing.set(key,{node,label:`${attribute} · ${node.getAttribute(attribute) || key}`,attribute});
    }
  });
  doc.querySelectorAll('[data-editor-event-resource][data-editor-missing]').forEach(node=>missing.set(node.dataset.editorEventResource,{node,label:(node.textContent || node.getAttribute('alt') || node.dataset.editorEventResource).slice(0,90),event:true}));
  $('#missing-summary').textContent=`${editingLocale==='de'?'EN':'DE'} · ${missing.size} fehlende Übersetzungen`;
  $('#missing-summary').hidden=previewMode || missing.size===0;
  if(previewMode || !missing.size){$('#missing-resources').hidden=true;$('#missing-summary').setAttribute('aria-expanded','false');}
  $('#missing-summary').dataset.hasMissing=String(missing.size>0);
  $('#missing-explanation').textContent=`Die Markierung zeigt ausschließlich fehlende Texte in ${editingLocale==='de'?'EN':'DE'}. Doppelklick oder Rechtsklick öffnet den Textdialog.`;
  $('#missing-list').replaceChildren();
  for(const [key,item] of missing){
    const button=document.createElement('button');button.type='button';button.textContent=item.label || key;
    button.addEventListener('click',()=>{
      if(!item.node.isConnected)return;
      item.node.scrollIntoView({block:'center'});
      if(item.event){const resource=item.node.dataset.editorEventResource;const split=resource.lastIndexOf('/');const event=eventRecords.find(event=>event.id===resource.slice(0,split));if(event)openEventField(event,resource.slice(split+1));}
      else if(item.attribute){stagePanelTranslation();$('#translation-filter').value='';$('#translation-missing').checked=false;renderTranslationKeys();keySelect.value=key;loadTranslation();setTab('translations');}
      else beginInlineEdit(item.node);
    });
    $('#missing-list').append(button);
  }
}

function attributeResources(node) {
  const resources=[];
  if(node.dataset.i18nPlaceholder)resources.push({key:node.dataset.i18nPlaceholder,attribute:'placeholder'});
  for(const entry of (node.dataset.i18nAttrs || '').split('|')){
    const [attribute,key]=entry.split(':').map(value=>value.trim());
    if(attribute && key)resources.push({key,attribute});
  }
  return resources;
}

function targetDescriptor(node) {
  if (!node) return null;
  const protectedRegion = node.closest('form,nav,header,footer,[data-editor-event-host],[data-i18n-html="true"]') ||
    (node.tagName !== 'MAIN' && node.querySelector('form,[data-editor-event-host]'));
  return {
    tag:node.tagName,
    parentTag:node.parentElement?.tagName,
    inMain:Boolean(node.closest('main')),
    insertionRoot:node.tagName==='MAIN' || node.matches('main > section,main > article,main > div,section,article,[data-bcb-layout]'),
    blocked:Boolean(protectedRegion) || Boolean(node.closest('[data-i18n]') && node.closest('[data-i18n]')!==node),
  };
}

function canInsert(type,position,node) {
  return !previewMode && insertionAllowed(type,position,targetDescriptor(node));
}

function updateInsertionControls() {
  const firstLayout=sectionLayouts[0]?.id;
  document.querySelectorAll('[data-open-insert]').forEach(button=>button.disabled=!firstLayout || !canInsert(firstLayout,button.dataset.openInsert,selectedNode()));
}

function openInsertion(position,type=sectionLayouts[0]?.id) {
  finishInlineEdit();
  insertionAnchor=selectedNode();
  if(!insertionAnchor)return;
  $('#insert-component').value=type;
  $('#insert-position').value=position;
  updateInsertionDialog();$('#insert-dialog').showModal();
}

function updateInsertionDialog() {
  const type=$('#insert-component').value;
  [...$('#insert-position').options].forEach(option=>option.disabled=!canInsert(type,option.value,insertionAnchor));
  $('#insert-confirm').disabled=!canInsert(type,$('#insert-position').value,insertionAnchor);
  $('#insert-target').textContent=`Auswahl: ${insertionAnchor?.getAttribute('aria-label') || insertionAnchor?.id || insertionAnchor?.tagName.toLowerCase() || 'keine'}`;
  $('#insert-message').textContent=$('#insert-confirm').disabled?'Hier kann diese Komponente nicht eingefügt werden. Bitte einen Container im Seiteninhalt wählen.':'';
}

function insertComponent(type,position,anchor) {
  if(!anchor?.isConnected || !canInsert(type,position,anchor)){setStatus('Hier ist diese Einfügung nicht zulässig.');return;}
  finishInlineEdit();stagePanelTranslation();
  const definition=sectionLayouts.find(item=>item.id===type),doc=canvas.contentDocument;
  if(!definition){setStatus('Unbekanntes Abschnittslayout.');return;}
  const resourcePrefix='editor_'+crypto.randomUUID().replaceAll('-','');
  let resourceIndex=0;
  function createNode(schema,root=false) {
    const element=doc.createElement(schema.tag);
    if(schema.className)element.className=schema.className;
    if(schema.resource){
      const key=`${resourcePrefix}_${schema.resource}_${resourceIndex++}`;
      element.dataset.i18n=key;element.textContent=schema.text;
      stageTranslation(key,'de',schema.text);stageTranslation(key,'en','');
    }
    if(root){element.dataset.bcbLayout=definition.id;element.dataset.bcbComponent=definition.id;}
    for(const child of schema.children || [])element.append(createNode(child));
    return element;
  }
  const node=createNode(definition.root,true);
  if(position==='inside')anchor.append(node);else anchor[position==='before'?'before':'after'](node);
  renderLocale();recordChange();
  selectOutline(node.dataset.editorKey,true);
  updateInsertionControls();
  setStatus(`${definition.label} eingefügt · ${position==='inside'?'im Container':position==='before'?'vor der Auswahl':'nach der Auswahl'} · noch nicht gespeichert`);
}

const inventory=$('#component-inventory');
for(const component of sectionLayouts){
  const button=document.createElement('button');button.type='button';button.draggable=true;button.dataset.component=component.id;button.textContent=component.label;button.title='Ziehen oder zum Einfügen anklicken';
  button.addEventListener('click',()=>openInsertion(canInsert(component.id,'inside',selectedNode())?'inside':'after',component.id));
  button.addEventListener('dragstart',event=>{draggedComponent=component.id;event.dataTransfer.setData('application/x-bcb-component',component.id);event.dataTransfer.setData('text/plain',component.id);event.dataTransfer.effectAllowed='copy';frame.classList.add('component-dragging');});
  button.addEventListener('dragend',()=>{draggedComponent='';clearDropIndicators();frame.classList.remove('component-dragging');});
  inventory.append(button);
}
$('#insert-component').replaceChildren(...sectionLayouts.map(item=>new Option(item.label,item.id)));
for(const id of ['insert-component','insert-position'])$('#'+id).addEventListener('change',updateInsertionDialog);
$('#insert-close').addEventListener('click',()=>$('#insert-dialog').close());
$('#insert-confirm').addEventListener('click',()=>{insertComponent($('#insert-component').value,$('#insert-position').value,insertionAnchor);$('#insert-dialog').close();});
document.querySelectorAll('[data-open-insert]').forEach(button=>button.addEventListener('click',()=>openInsertion(button.dataset.openInsert)));
outline.addEventListener('contextmenu',openContextMenu);
installDropTargets(outline,true);

function clearDropIndicators() {
  for(const doc of [document,canvas.contentDocument])doc?.querySelectorAll('[data-editor-drop]').forEach(node=>delete node.dataset.editorDrop);
}

function dropTarget(event,tree) {
  const row=tree?event.target.closest('[data-select-key]'):null;
  const node=tree ? (row?canvas.contentDocument?.querySelector(`[data-editor-key="${CSS.escape(row.dataset.selectKey)}"]`):null) : (event.target.closest('[data-i18n]') || event.target.closest('[data-editor-key]'));
  if(!node)return {};
  const rect=(row || node).getBoundingClientRect();
  const fraction=(event.clientY-rect.top)/Math.max(1,rect.height);
  let position=fraction<0.25?'before':fraction>0.75?'after':'inside';
  if(!canInsert(draggedComponent,position,node) && position==='inside')position=fraction<0.5?'before':'after';
  return {node,position,indicator:row || node};
}

function installDropTargets(host,tree=false) {
  host.addEventListener('dragover',event=>{
    if(!draggedComponent)return;
    const target=dropTarget(event,tree);clearDropIndicators();
    if(!canInsert(draggedComponent,target.position,target.node)){event.dataTransfer.dropEffect='none';return;}
    event.preventDefault();event.dataTransfer.dropEffect='copy';target.indicator.dataset.editorDrop=target.position;
  });
  host.addEventListener('drop',event=>{
    if(!draggedComponent)return;
    event.preventDefault();const target=dropTarget(event,tree);clearDropIndicators();
    insertComponent(draggedComponent,target.position,target.node);
    draggedComponent='';frame.classList.remove('component-dragging');
  });
  host.addEventListener('dragleave',event=>{if(!host.contains(event.relatedTarget))clearDropIndicators();});
}

function isStructuralNode(node){return Boolean(node && node.tagName!=='MAIN' && node.matches('section,article,[data-bcb-layout]') && node.closest('main') && !targetDescriptor(node)?.blocked);}
function structuralSiblings(node){return [...node.parentElement.children].filter(isStructuralNode);}

function eventResource(node){const key=node?.dataset.editorEventResource;if(!key)return null;const index=key.lastIndexOf('/');const event=eventRecords.find(item=>item.id===key.slice(0,index));return event?{event,field:key.slice(index+1)}:null;}
function markEventNode(node,values){const other=editingLocale==='de'?'en':'de';if(!previewMode && !values[other]?.trim())node.dataset.editorMissing=other.toUpperCase()+' fehlt';else delete node.dataset.editorMissing;}
function resourceEditable(node){return Boolean(node?.matches('[data-i18n],[data-editor-event-resource]') || (node && attributeResources(node).length));}
function openResourceDialog(node){
  if(previewMode || !node)return;
  finishInlineEdit();stagePanelTranslation();
  const resource=eventResource(node);
  if(resource){openEventField(resource.event,resource.field);return;}
  const key=node.closest('[data-i18n]')?.dataset.i18n || attributeResources(node)[0]?.key;
  if(!key)return;
  $('#text-dialog').dataset.key=key;
  $('#text-dialog-title').textContent='Text bearbeiten';
  $('#text-dialog-de').value=draftValue(key,'de') || '';
  $('#text-dialog-en').value=draftValue(key,'en') || '';
  $('#text-dialog').showModal();
  $('#text-dialog-'+editingLocale).focus();
}
$('#text-dialog-close').addEventListener('click',()=>$('#text-dialog').close());
$('#text-dialog-apply').addEventListener('click',()=>{
  const key=$('#text-dialog').dataset.key;
  for(const locale of ['de','en'])stageTranslation(key,locale,$('#text-dialog-'+locale).value);
  $('#text-dialog').close();renderLocale();recordChange();renderTranslationKeys();
});

function projectEventContent(){
  const doc=canvas.contentDocument;if(!doc || !eventRecords.length)return;
  doc.querySelectorAll('[data-event-id][data-event-field]').forEach(node=>{
    if(!node.closest('[data-editor-event-host]') && !sourceFragments.has(node))sourceFragments.set(node,node.innerHTML);
  });
  doc.querySelectorAll('[data-event-id][data-event-attrs]').forEach(node=>{
    const original=sourceAttributes.get(node) || {};
    for(const entry of node.dataset.eventAttrs.split('|')){const attribute=entry.split(':')[0];if(!Object.hasOwn(original,attribute))original[attribute]=node.getAttribute(attribute);}
    sourceAttributes.set(node,original);
    const [attribute,field]=node.dataset.eventAttrs.split('|')[0].split(':');
    const event=eventRecords.find(item=>item.id===node.dataset.eventId);
    if(event && eventText(event,field)){node.dataset.editorEventAttribute=attribute;node.dataset.editorEventResource=event.id+'/'+field;markEventNode(node,eventText(event,field));}
  });
  if(activeInlineNode?.dataset.editorEventResource)return;
  applyEventBindings(doc,{events:eventRecords},{locale:editingLocale,onField(node,event,field){
    node.dataset.editorEventResource=event.id+'/'+field;
    node.dataset.editorTranslated='';node.contentEditable='false';markEventNode(node,eventText(event,field));
  }});
}
