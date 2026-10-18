const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contextualActions,wardrobeMoreActions,itemMoreActions,furnitureMoreActions,furnitureMenus}=require('../src/domain/wardrobe/contextual-actions.js');
// Furniture: nothing selected offers Add (a tab per kind); every piece of furniture has the same tools in the same order,
// the steps furniture planners use (add another, interior, size, fronts), so learning one teaches the other.
const FURNITURE_TOOLS=['new','interior','resize','fronts','more'];
for(const [selection,expected] of [['none',['add','more']],['studio',['walls','ceiling']],['wardrobe',FURNITURE_TOOLS],['kitchen',FURNITURE_TOOLS],['item',['replace','resize','duplicate','remove','more']],['divider',['resize','duplicate','remove']]]) {
 test(selection+' exposes its editing commands with persistent history',()=>assert.deepEqual(contextualActions(selection).map(([key])=>key),[...expected,'undo','redo']));
}
test('Add is named for what it adds',()=>{assert.equal(contextualActions('wardrobe')[0][2],'New wardrobe');assert.equal(contextualActions('kitchen')[0][2],'Add cabinet');});
test('Interior leads with Auto design only where it can plan, then sections and Add item',()=>{
 assert.deepEqual(furnitureMenus.wardrobe.interior.map(([key])=>key),['auto','sections','add-item']);
 assert.deepEqual(furnitureMenus.kitchen.interior.map(([key])=>key),['sections','add-item']);
});
test('every kind of furniture has the same More: duplicate, reset, remove',()=>{
 for(const more of Object.values(furnitureMoreActions))assert.deepEqual(more.map(([key])=>key),['duplicate','reset','remove']);
 assert.deepEqual(wardrobeMoreActions,furnitureMoreActions.wardrobe);
});
test('no toolbar offers Move: furniture, an item or a divider is dragged where it goes',()=>{for(const s of ['wardrobe','kitchen','item','divider'])assert.ok(!contextualActions(s).some(([key])=>key==='move'),s);});
test('item More exposes its storage purpose; Replace is a tool',()=>assert.deepEqual(itemMoreActions,[['stores','Stores']]));
const {wallMoreActions,studioMoreActions,fieldActions}=require('../src/domain/wardrobe/contextual-actions.js');
test('a selected wall offers Size and Split directly, with Door and Window in More',()=>{
 assert.deepEqual(contextualActions('wall').map(([key])=>key),['wall-size','split','wall-paint','more','undo','redo']);
 assert.deepEqual(studioMoreActions.map(([key])=>key),['door','window','archway']);
 assert.deepEqual(wallMoreActions.map(([key])=>key),['door','window','archway','remove']);
 assert.deepEqual(contextualActions('opening').map(([key])=>key),['opening-size','remove','undo','redo']);
 assert.deepEqual(contextualActions('ceiling').map(([key])=>key),['ceiling-size','ceiling-shape','flip','remove','undo','redo']);
 assert.ok(fieldActions.every(key=>['studio','wall','opening','ceiling'].some(s=>contextualActions(s).some(([k])=>k===key))||wallMoreActions.some(([k])=>k===key)));
});
