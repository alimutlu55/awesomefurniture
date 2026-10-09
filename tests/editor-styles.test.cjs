const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');

test('mounting preserves Auto design layout selectors at desktop and mobile widths',()=>{
 const {scopeEditorStyles}=require('../src/presentation/editor/editor-styles.ts');
 const css=readFileSync('src/presentation/editor/editor.css','utf8');
 const scoped=scopeEditorStyles(css,['wizard','left-body']);
 assert.ok(scoped.includes('.wizard-body{display:grid;grid-template-columns:270px 1fr;min-height:0;flex:1}'));
 assert.ok(scoped.includes('.wizard-body{grid-template-columns:220px 1fr}'));
 assert.ok(scoped.includes('.wizard-body{display:block;overflow:auto}'));
 assert.ok(scoped.includes('[data-editor-id="left-body"]{display:none}'));
 assert.ok(scoped.includes(':host{background:var(--bg)'));
 assert.match(scoped, /@container\s*\(max-width:620px\)/);
 assert.ok(scoped.includes('height:min(850px,94cqh)'));
 assert.ok(!scoped.includes('.wizard-:host'));
});
