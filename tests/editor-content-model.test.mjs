import test from 'node:test';
import assert from 'node:assert/strict';
import { components, insertionAllowed, localizedValue, missingOtherLanguage } from '../editor/content-model.mjs';
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

test('all insertion entry points share container and sibling restrictions',()=>{
  for(const component of components){
    const text={tag:'P',parentTag:'DIV',inMain:true,blocked:false};
    assert.equal(insertionAllowed(component.id,'inside',text),false);
    assert.equal(insertionAllowed(component.id,'before',text),true);
    assert.equal(insertionAllowed(component.id,'after',text),true);
    assert.equal(insertionAllowed(component.id,'inside',{...text,tag:'DIV'}),true);
    assert.equal(insertionAllowed(component.id,'after',{...text,parentTag:'UL'}),false);
    assert.equal(insertionAllowed(component.id,'inside',{...text,tag:'DIV',blocked:true}),false);
    assert.equal(insertionAllowed(component.id,'inside',{...text,tag:'DIV',inMain:false}),false);
    assert.equal(insertionAllowed(component.id,'before',{...text,tag:'MAIN'}),false);
  }
  assert.equal(insertionAllowed('script','inside',{tag:'MAIN',inMain:true}),false);
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
