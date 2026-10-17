const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contextualActions,wardrobeMoreActions,itemMoreActions,furnitureMoreActions}=require('../src/domain/wardrobe/contextual-actions.js');
// Furniture: nothing selected chooses Wardrobe or Cabinets; a wardrobe leads with Auto design; a kitchen cabinet has no Shape
// tool. Add item is on the model (in the selected space), not in the bar.
for(const [selection,expected] of [['none',['wardrobe','kitchen','more']],['studio',['walls','ceiling']],['wardrobe',['auto','resize','shape','more']],['kitchen',['new','resize','sections','more']],['item',['duplicate','remove','resize','more']],['divider',['duplicate','remove','resize']]]) {
 test(selection+' exposes its editing commands with persistent history',()=>assert.deepEqual(contextualActions(selection).map(([key])=>key),[...expected,'undo','redo']));
}
test('secondary wardrobe commands remain available in More, with its sections',()=>assert.deepEqual(wardrobeMoreActions.map(([key])=>key),['new','sections','material','doors','duplicate','reset','remove']));
test('no toolbar offers Move: an item or a divider is dragged where it goes',()=>{for(const s of ['wardrobe','kitchen','item','divider'])assert.ok(!contextualActions(s).some(([key])=>key==='move'),s);});
test('a kitchen cabinet More adds another cabinet and has no whole-front doors',()=>assert.deepEqual(furnitureMoreActions.kitchen.map(([key,label])=>key==='new'?label:key),['Add cabinet','material','duplicate','reset','remove']));
test('a cabinet offers Add cabinet in the toolbar, and no Add item; a wardrobe offers neither',()=>{for(const s of ['wardrobe','kitchen','item','divider'])assert.ok(!contextualActions(s).some(([key])=>key==='add'),s);assert.equal(contextualActions('kitchen')[0][0],'new');});
test('default Wardrobe More owns Max reach size',()=>assert.deepEqual(require('../src/domain/wardrobe/contextual-actions.js').defaultWardrobeMoreActions,[['reach','Max reach size']]));
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
