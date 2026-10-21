import { readFileSync } from 'node:fs';
import path from 'node:path';
import { localOperator } from './policy.mjs';

export function codespaceHost(env=process.env,port='4321') {
  if(env.CODESPACES!=='true')return null;
  if(!/^[a-z0-9-]+$/.test(env.CODESPACE_NAME || '') || !/^\d{2,5}$/.test(String(port)) ||
    (env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev')!=='app.github.dev')throw Error('Ungültige Codespaces-Umgebung.');
  return `${env.CODESPACE_NAME}-${port}.app.github.dev`;
}
export function editorOriginAllowed(req,env=process.env,port='4321') {
  const local=`http://${req.headers.host}`;
  const host=codespaceHost(env,port);
  if(host && req.headers.host===host)return req.headers.origin===`https://${host}`;
  return req.headers.origin===local || (host && req.headers.origin===`https://${host}`);
}
export function editorRequestAllowed(req,env=process.env,port='4321') {
  const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  if(!['127.0.0.1','::1'].includes(remote))return false;
  try {
    const url=new URL(`http://${req.headers.host}`);
    if(url.host!==req.headers.host?.toLowerCase())return false;
    return ['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.host===codespaceHost(env,port);
  }catch {return false;}
}
export function editorIdentity(root,env=process.env) {
  const profile=env.BCB_EDITOR_PROFILE || (env.CODESPACES==='true'?'contributor':'operator');
  if(env.CODESPACES==='true' && profile==='operator')throw Error('Codespaces startet ausschließlich mit begrenztem Beitragsprofil.');
  if(profile==='operator')return {...localOperator,label:'Lokaler Betreiber',test:false};
  if(profile==='github-contributor') {
    const login=env.BCB_EDITOR_VERIFIED_LOGIN;
    const assignments=JSON.parse(readFileSync(path.join(root,'policy/contributors.json'),'utf8'));
    const assignment=login && Object.hasOwn(assignments.contributors,login)?assignments.contributors[login]:null;
    if(assignments.version!==1 || !assignment || !/^[a-z0-9-]+$/.test(login) || !Array.isArray(assignment.documents) || !Array.isArray(assignment.languages) || assignment.languages.some(locale=>!['de','en'].includes(locale)))throw Error('Kein freigeschalteter GitHub-Beitragender.');
    return {id:login,roles:['journal-contributor'],documents:assignment.documents || [],languages:assignment.languages || [],label:`GitHub-Beitragender · ${login}`,test:false};
  }
  if(profile!=='contributor')throw Error('Unbekanntes Editorprofil.');
  const pages=JSON.parse(readFileSync(path.join(root,'content/site-pages.json'),'utf8'));
  return {id:'test-journal-contributor',roles:['journal-contributor'],documents:pages.filter(page=>['redaktion-journal','redaktion-lorem-ipsum'].includes(page.id)).map(page=>page.id),languages:['de','en'],label:'Testbeitragender · Journal',test:true};
}
