import test from 'node:test';
import assert from 'node:assert/strict';
import { insertionAllowed, localizedValue, missingOtherLanguage } from '../editor/content-model.mjs';
import { sectionLayouts, validateSectionLayouts, validateSectionLayoutMarkers } from '../editor/section-layouts.mjs';
import { applyTranslationDrafts, readTranslations } from '../editor/local-translations.mjs';

test('translation indicator concerns only the other locale, including pending drafts',()=>{
  const source={de:{title:'Quelle'},en:{title:''}};
  assert.equal(missingOtherLanguage(source,{},'title','de'),'en');
  assert.equal(missingOtherLanguage(source,{},'title','en'),'');
  assert.equal(missingOtherLanguage(source,{en:{title:'Translation'}},'title','de'),'');
  assert.equal(missingOtherLanguage(source,{de:{title:'  '}},'title','en'),'de');
});

test('locale fallback detects blank resources without treating the source as a translation',()=>{
  const source={de:{title:'Quelle'},en:{title:''}};
  assert.deepEqual(localizedValue(source,{},'title','en'),{text:'Quelle',missing:true,source:'de'});
  assert.deepEqual(localizedValue(source,{en:{title:'Translated'}},'title','en'),{text:'Translated',missing:false,source:'de'});
  assert.equal(source.en.title,'');
  assert.equal(localizedValue(source,{de:{title:''}},'title','de','Original').missing,true);
  assert.equal(localizedValue({de:{title:'  '},en:{title:'English'}},{},'title','de').text,'English');
});

test('section templates are complete, semantic and use stable layout identifiers',()=>{
  assert.equal(validateSectionLayouts(),true);
  assert.deepEqual(sectionLayouts.map(layout=>layout.id),['editorial-section','feature-grid','statement-section']);
  assert.throws(()=>validateSectionLayouts([{...sectionLayouts[0],id:'bad layout'}]));
  assert.throws(()=>validateSectionLayouts([{...sectionLayouts[0],root:{...sectionLayouts[0].root,tag:'div'}}]));
});

test('section insertion is limited to approved semantic roots',()=>{
  for(const layout of sectionLayouts){
    const root={tag:'SECTION',parentTag:'MAIN',inMain:true,insertionRoot:true,blocked:false};
    const main={tag:'MAIN',inMain:true,insertionRoot:true,blocked:false};
    assert.equal(insertionAllowed(layout.id,'inside',root),true);
    assert.equal(insertionAllowed(layout.id,'before',root),true);
    assert.equal(insertionAllowed(layout.id,'after',root),true);
    assert.equal(insertionAllowed(layout.id,'inside',main),true);
    assert.equal(insertionAllowed(layout.id,'inside',{...root,blocked:true}),false);
    assert.equal(insertionAllowed(layout.id,'inside',{...root,inMain:false}),false);
    assert.equal(insertionAllowed(layout.id,'inside',{...root,insertionRoot:false}),false);
    assert.equal(insertionAllowed(layout.id,'after',{...root,parentTag:'UL'}),false);
  }
  assert.equal(insertionAllowed('script','inside',{tag:'MAIN',inMain:true,insertionRoot:true}),false);
  assert.equal(insertionAllowed(sectionLayouts[0].id,'inside',{tag:'DIV',inMain:true,insertionRoot:true}),false);
});

test('saved section markers only accept registered section templates',()=>{
  const valid='<section class="section-band" data-bcb-layout="editorial-section" data-bcb-component="editorial-section"></section>';
  assert.equal(validateSectionLayoutMarkers(valid),valid);
  for(const invalid of [
    valid.replace('editorial-section','freeform'),
    valid.replace('<section','<div').replace('</section>','</div>'),
    valid.replace('data-bcb-component="editorial-section"','data-bcb-component="container"'),
    valid.replace('data-bcb-layout="editorial-section"','data-bcb-layout=freeform'),
  ])assert.throws(()=>validateSectionLayoutMarkers(invalid));
});

test('one translation batch saves both editing languages and newly inserted resource keys',()=>{
  const source='const translations = {de:{htmlLang:"de",title:"Quelle"},en:{htmlLang:"en",title:"Source"}};';
  const updated=applyTranslationDrafts(source,{de:{title:'Neu',editor_added:'Zusatz'},en:{title:'New',editor_added:''}});
  const values=readTranslations(updated);
  assert.equal(values.de.title,'Neu');assert.equal(values.en.title,'New');
  assert.equal(values.de.editor_added,'Zusatz');assert.equal(values.en.editor_added,'');
  assert.equal(readTranslations(source).de.title,'Quelle');
  assert.throws(()=>applyTranslationDrafts(source,{fr:{title:'Bonjour'}}));
  assert.throws(()=>applyTranslationDrafts(source,{de:{htmlLang:'en'}}));
  assert.throws(()=>applyTranslationDrafts(source,{de:{unknown:'text'}}));
});
