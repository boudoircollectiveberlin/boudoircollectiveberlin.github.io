import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceNavigationLink } from '../editor/navigation.mjs';

test('shared menu edits preserve local anchors and unrelated links',()=>{
  const html='<nav><a href="#old" data-i18n="navEvents">Events</a><a href="account.html" data-i18n="navRegister">Account</a></nav><main><a href="#old" data-i18n="navEvents">Body link</a></main>';
  const result=replaceNavigationLink(html,'navEvents','#events','account');
  assert.equal(result.count,1);
  assert.ok(result.html.includes('href="index.html#events"'));
  assert.ok(result.html.includes('<main><a href="#old"'));
  assert.ok(result.html.includes('href="account.html"'));
  assert.ok(replaceNavigationLink(html,'navEvents','#events','index').html.includes('href="#events"'));
  for(const bad of ['javascript:alert(1)','data:text/html,hello','x" onclick="bad','https://example.com/<script>']) assert.throws(()=>replaceNavigationLink(html,'navEvents',bad,'index'));
});
