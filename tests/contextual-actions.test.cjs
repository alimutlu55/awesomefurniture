const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contextualActions,wardrobeMoreActions,itemMoreActions}=require('../src/domain/wardrobe/contextual-actions.js');
for(const [selection,expected] of [['none',['add','auto']],['wardrobe',['move','resize','sections','more']],['item',['duplicate','remove','resize','more']]]) {
 test(selection+' exposes its editing commands with persistent history',()=>assert.deepEqual(contextualActions(selection).map(([key])=>key),[...expected,'undo','redo']));
}
test('secondary wardrobe commands remain available in More',()=>assert.deepEqual(wardrobeMoreActions.map(([key])=>key),['shape','material','reach','doors','duplicate','reset','remove']));
test('item More exposes replacement and storage purpose',()=>assert.deepEqual(itemMoreActions,[['replace','Replace'],['stores','Stores']]));
const {wallMoreActions,fieldActions}=require('../src/domain/wardrobe/contextual-actions.js');
test('a selected wall offers its size, split, door and window, with more in More',()=>{
 assert.deepEqual(contextualActions('wall').map(([key])=>key),['wall-size','split','door','window','more','undo','redo']);
 assert.deepEqual(wallMoreActions.map(([key])=>key),['archway','add-wall','remove']);
 assert.deepEqual(contextualActions('opening').map(([key])=>key),['opening-size','remove','undo','redo']);
 assert.ok(fieldActions.every(key=>contextualActions('wall').some(([k])=>k===key)||contextualActions('opening').some(([k])=>k===key)));
});
