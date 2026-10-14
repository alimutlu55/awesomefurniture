const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contextualActions,wardrobeMoreActions,itemMoreActions}=require('../src/domain/wardrobe/contextual-actions.js');
for(const [selection,expected] of [['none',['add','wardrobe','auto']],['studio',['walls','ceiling']],['wardrobe',['move','resize','shape','sections','more']],['item',['duplicate','remove','resize','more']],['divider',['duplicate','remove','resize']]]) {
 test(selection+' exposes its editing commands with persistent history',()=>assert.deepEqual(contextualActions(selection).map(([key])=>key),[...expected,'undo','redo']));
}
test('secondary wardrobe commands remain available in More',()=>assert.deepEqual(wardrobeMoreActions.map(([key])=>key),['material','reach','doors','duplicate','reset','remove']));
test('item More exposes replacement and storage purpose',()=>assert.deepEqual(itemMoreActions,[['replace','Replace'],['stores','Stores']]));
const {wallMoreActions,studioMoreActions,fieldActions}=require('../src/domain/wardrobe/contextual-actions.js');
test('a selected wall offers Size and Split directly, with Door and Window in More',()=>{
 assert.deepEqual(contextualActions('wall').map(([key])=>key),['wall-size','split','wall-paint','more','undo','redo']);
 assert.deepEqual(studioMoreActions.map(([key])=>key),['door','window','archway']);
 assert.deepEqual(wallMoreActions.map(([key])=>key),['door','window','archway','remove']);
 assert.deepEqual(contextualActions('opening').map(([key])=>key),['opening-size','remove','undo','redo']);
 assert.deepEqual(contextualActions('ceiling').map(([key])=>key),['ceiling-size','ceiling-shape','flip','remove','undo','redo']);
 assert.ok(fieldActions.every(key=>['studio','wall','opening','ceiling'].some(s=>contextualActions(s).some(([k])=>k===key))||wallMoreActions.some(([k])=>k===key)));
});
