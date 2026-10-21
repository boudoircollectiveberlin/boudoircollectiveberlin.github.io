import test from 'node:test';
import assert from 'node:assert/strict';
import localEditor from '../editor/local-editor.mjs';

test('Codespaces port root opens editor while public routes and host boundaries stay intact',async()=>{
  const overrides={CODESPACES:'true',CODESPACE_NAME:'bcb-entry-check',BCB_EDITOR_PROFILE:'contributor',LOCAL_EDITOR:'1',BCB_EDITOR_PORT:'4321'};
  const before=Object.fromEntries(Object.keys(overrides).map(key=>[key,process.env[key]]));
  Object.assign(process.env,overrides);
  try {
    const plugin=localEditor();
    plugin.hooks['astro:config:setup']({command:'dev',updateConfig(){}});
    let middleware;
    plugin.hooks['astro:server:setup']({server:{middlewares:{use(fn){middleware=fn;}}}});
    async function request(url,remote='127.0.0.1') {
      let result={};
      await middleware({url,method:'GET',socket:{remoteAddress:remote},headers:{host:'bcb-entry-check-4321.app.github.dev'}},
        {writeHead(status,headers){result={status,headers};},end(){result.ended=true;}},()=>{result.next=true;});
      return result;
    }
    const entry=await request('/');
    assert.equal(entry.status,302);
    assert.equal(entry.headers.Location,'/__editor/');
    assert.equal(entry.headers['Cache-Control'],'no-store');
    assert.equal((await request('/index.html')).next,true);
    assert.equal((await request('/', '192.0.2.1')).next,true);
    delete process.env.CODESPACES;
    const local=localEditor();
    local.hooks['astro:config:setup']({command:'dev',updateConfig(){}});
    local.hooks['astro:server:setup']({server:{middlewares:{use(fn){middleware=fn;}}}});
    assert.equal((await request('/')).next,true);
  } finally {
    for(const [key,value] of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
