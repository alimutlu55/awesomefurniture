const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resizeTarget}=require('../src/domain/wardrobe/resize-target.ts');
const {createResizePresenter}=require('../src/presentation/editor/resize-presenter.js');
test('shared Resize routes wardrobe, item and divider selection to the proper existing host',()=>{
 let selection={item:-1,divider:-1};
 const opened=[];
 const presenter=createResizePresenter({getSelection:()=>selection,openWardrobe:()=>opened.push('wardrobe'),openItem:()=>opened.push('item'),openDivider:()=>opened.push('divider')});
 for(const state of [{item:-1,divider:-1},{item:0,divider:-1},{item:-1,divider:0},{item:2,divider:1}]){
  selection=state;presenter.open();assert.equal(opened.at(-1),resizeTarget(state));
 }
 assert.deepEqual(opened,['wardrobe','item','divider','divider']);
});
