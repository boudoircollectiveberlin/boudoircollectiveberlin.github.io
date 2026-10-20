export function pageNavigationEntries(pages) {
  return pages.map(page=>({...page,href:page.path,path:[page.area || 'Website',...(page.type==='article'?['Artikel']:page.type==='event'?['Eventseiten']:[])]}));
}
export function filterNavigationEntries(entries,area,query='') {
  const normalize=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('de');
  const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry=>entry.path[0]===area && terms.every(term=>normalize(`${entry.title} ${entry.href} ${entry.path.join(' ')}`).includes(term)));
}
export function createPageNavigation() {
  const area=document.getElementById('page-area'),select=document.getElementById('page'),search=document.getElementById('page-search');
  let entries=[],current='';
  function render() {
    const matches=filterNavigationEntries(entries,area.value,search.value);
    select.replaceChildren(new Option(matches.length?'Seite / Artikel wählen …':'Keine Treffer',''));
    const groups=new Map();
    for(const entry of matches) {
      const branch=entry.path.slice(1).join(' / ');
      if(branch && !groups.has(branch)){const group=document.createElement('optgroup');group.label=branch;groups.set(branch,group);select.append(group);}
      (groups.get(branch) || select).append(new Option(entry.title,entry.id));
    }
    select.value=matches.some(entry=>entry.id===current)?current:'';
    document.getElementById('page-count').textContent=`${matches.length} von ${entries.filter(entry=>entry.path[0]===area.value).length} Einträgen`;
  }
  area.addEventListener('change',()=>{search.value='';render();});search.addEventListener('input',render);
  return {
    setEntries(pages,id){entries=pageNavigationEntries(pages);area.replaceChildren(...[...new Set(entries.map(entry=>entry.path[0]))].map(name=>new Option(name,name)));this.setCurrent(id);area.disabled=search.disabled=select.disabled=false;},
    setCurrent(id){current=id;const entry=entries.find(entry=>entry.id===id);if(entry){area.value=entry.path[0];document.getElementById('page-current').textContent='Geöffnet: '+[...entry.path,entry.title].join(' / ');}search.value='';render();},
  };
}
