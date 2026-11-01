const {test}=require('node:test');
const assert=require('node:assert/strict');
const {contextualActions,wardrobeMoreActions,itemMoreActions,furnitureMoreActions,furnitureMenus}=require('../src/domain/wardrobe/contextual-actions.js');
// Furniture: nothing selected offers Add (a tab per kind); every piece of furniture has the same tools in the same order,
// the steps furniture planners use (add an item, interior, size, fronts, Make), so learning one teaches the other.
const FURNITURE_TOOLS=['add-item','interior','resize','fronts','make','more'];
for(const [selection,expected] of [['none',['add','more']],['studio',['new']],['room-fixture',['fixture-type','fixture-size','fixture-finish','more']],['wardrobe',FURNITURE_TOOLS],['kitchen',FURNITURE_TOOLS],['item',['replace','resize','duplicate','remove','more']],['divider',['resize','duplicate','remove']]]) {
 test(selection+' exposes its editing commands with persistent history',()=>assert.deepEqual(contextualActions(selection).map(([key])=>key),[...expected,'undo','redo']));
}
test('Make holds the toolbar while it is open: Done first, then its own tools; View lists the views, looks and part numbers',()=>{
 const {makeViewActions}=require('../src/domain/wardrobe/contextual-actions.js');
 assert.deepEqual(contextualActions('make').map(([key])=>key),['make-done','make-apart','make-fronts','make-measures','make-view','make-parts','undo','redo']);
 assert.deepEqual(makeViewActions.map(([key])=>key),['view-iso','view-front','view-side','view-top','look-lines','look-material','look-xray','make-numbers']);
});
test('selected furniture offers Add item directly',()=>{for(const kind of ['wardrobe','kitchen'])assert.deepEqual(contextualActions(kind)[0],['add-item','Add item']);});
test('Interior leads with Auto design only where it can plan, then sections',()=>{
 assert.deepEqual(furnitureMenus.wardrobe.interior.map(([key])=>key),['auto','sections']);
 assert.deepEqual(furnitureMenus.kitchen.interior.map(([key])=>key),['sections']);
});
test('every kind of furniture has the same More: duplicate, reset, remove',()=>{
 for(const more of Object.values(furnitureMoreActions))assert.deepEqual(more.map(([key])=>key),['duplicate','reset','remove']);
 assert.deepEqual(wardrobeMoreActions,furnitureMoreActions.wardrobe);
});
test('no toolbar offers Move: furniture, an item or a divider is dragged where it goes',()=>{for(const s of ['wardrobe','kitchen','item','divider'])assert.ok(!contextualActions(s).some(([key])=>key==='move'),s);});
test('item More exposes its storage purpose; Replace is a tool',()=>assert.deepEqual(itemMoreActions,[['stores','Stores']]));
const {wallMoreActions,studioMoreActions,fieldActions}=require('../src/domain/wardrobe/contextual-actions.js');
test('a selected wall offers Add, Size, Paint/Finish directly with Split and Remove in More',()=>{
 assert.deepEqual(contextualActions('wall').map(([key])=>key),['new','wall-size','wall-paint','more','undo','redo']);
 assert.equal(contextualActions('wall')[0][1],'Add');
 assert.deepEqual(wallMoreActions.map(([key])=>key),['split','remove']);
 assert.deepEqual(contextualActions('opening').map(([key])=>key),['opening-size','remove','undo','redo']);
 // A ceiling's drawing and dimensions share Size.
 assert.deepEqual(contextualActions('ceiling').map(([key])=>key),['ceiling-size','flip','remove','undo','redo']);
 assert.ok(fieldActions.every(key=>['studio','wall','opening','ceiling'].some(s=>contextualActions(s).some(([k])=>k===key))||wallMoreActions.some(([k])=>k===key)));
});

test('every editable selection has exactly one Size entry and no separate Shape entry',()=>{
 for(const selection of ['wardrobe','kitchen','installation','fixture','item','divider','wall','ceiling','opening','room-fixture']) {
  const actions=contextualActions(selection);
  assert.equal(actions.filter(([,label])=>label==='Size').length,1,selection);
  assert.ok(!actions.some(([,label])=>label==='Shape'),selection);
 }
});
