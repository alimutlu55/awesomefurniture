const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contextualActions,wardrobeMoreActions,itemMoreActions}=require('../src/domain/wardrobe/contextual-actions.js');
for(const [selection,expected] of [['none',['add','auto']],['wardrobe',['move','resize','sections','more']],['item',['duplicate','remove','resize','more']]]) {
 test(selection+' exposes its editing commands with persistent history',()=>assert.deepEqual(contextualActions(selection).map(([key])=>key),[...expected,'undo','redo']));
}
test('secondary wardrobe commands remain available in More',()=>assert.deepEqual(wardrobeMoreActions.map(([key])=>key),['shape','material','reach','doors','duplicate','reset','remove']));
test('item More exposes replacement and storage purpose',()=>assert.deepEqual(itemMoreActions,[['replace','Replace'],['stores','Stores']]));
