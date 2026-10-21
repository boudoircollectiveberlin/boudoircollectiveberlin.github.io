import { execFileSync } from 'node:child_process';
import { validateContribution } from '../editor/contribution-check.mjs';
const base=process.env.BCB_CONTRIBUTION_BASE,head=process.env.BCB_CONTRIBUTION_HEAD,login=process.env.BCB_CONTRIBUTOR_LOGIN?.toLowerCase();
if(!/^[a-f0-9]{40}$/.test(base || '') || !/^[a-f0-9]{40}$/.test(head || '') || !/^[a-z0-9-]+$/.test(login || ''))throw Error('Verifizierte Base-/Head-SHAs und GitHub-Autor aus vertrauenswürdigen PR-Metadaten erforderlich.');
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024});
const read=(revision,file)=>git(['show',`${revision}:${file}`]);
const policy=JSON.parse(read(base,'policy/content-rbac.json')),assignments=JSON.parse(read(base,'policy/contributors.json'));
if(!Object.hasOwn(assignments.contributors,login))throw Error('GitHub-Autor ist auf dem Zielbranch nicht freigeschaltet.');
const identity={id:login,roles:['journal-contributor'],documents:assignments.contributors[login].documents || [],languages:assignments.contributors[login].languages || []};
const tokens=git(['diff','--name-status','--no-renames','-z',base,head]).split('\0').filter(Boolean),changes=[];
for(let i=0;i<tokens.length;i+=2){const file=tokens[i+1];const mode=git(['ls-tree',head,'--',file]).split(' ')[0];changes.push({status:tokens[i],path:file,mode});}
// Reject path changes before reading any candidate file beyond bounded content blobs.
for(const change of changes)if(!['A','M'].includes(change.status) || change.mode!=='100644' || !(change.path==='i18n.js' || change.path==='content/site-pages.json' || /^src\/content\/pages\/redaktion-[a-z0-9-]+\.html$/.test(change.path)))throw Error(`Unzulässiger Beitragspfad: ${change.path}`);
const before=JSON.parse(read(base,'content/site-pages.json')),after=JSON.parse(read(head,'content/site-pages.json'));
const fixed=['index','account','legal','event-wrodow','event-grabowsee'];
const baseHtml=Object.fromEntries([...fixed,...before.map(page=>page.id)].map(id=>[id,read(base,`src/content/pages/${id}.html`)]));
const candidateHtml={...baseHtml,...Object.fromEntries(after.map(page=>[page.id,read(head,`src/content/pages/${page.id}.html`)]))};
console.log(JSON.stringify(validateContribution({policy,identity,changes,basePages:read(base,'content/site-pages.json'),candidatePages:read(head,'content/site-pages.json'),baseI18n:read(base,'i18n.js'),candidateI18n:read(head,'i18n.js'),baseHtml,candidateHtml})));
