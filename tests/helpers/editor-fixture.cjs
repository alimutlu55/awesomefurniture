// Fixtures execute imported production modules. VM scripts below only describe inputs.
const {createWardrobeGeometry}=require('../../src/domain/geometry/wardrobe-geometry.js');
const {createDesignCommands}=require('../../src/application/commands/design-commands.js');
const {createEditorGestures}=require('../../src/presentation/editor/editor-gestures.js');
function designFixture(c){
 Object.assign(c,createWardrobeGeometry(()=>c.S),createDesignCommands(()=>c.S,{changed:()=>c.update?.(),report:()=>{},selectionChanged:v=>Object.assign(c,v)}));
 return c;
}
function dependencies(c){return {
 dom:require('./dom-fixture.cjs').domFixture(),
 camera:c, rendering:c, interactions:c, inspector:c, planner:c, shell:c, picking:c,
 cameraState:c, interactionState:c, renderState:c, selectionState:c, plannerState:c, shellState:c,
 geometry:c, cabinetGeometry:c, resources:c, commands:c, sceneCommands:c,
 history:c.history, lifetime:c.lifetime, settings:{budget:900}, touch:{pinch(){},release(){},followEdge(){},stopFollowing(){}},
 model:{get scene(){return {wardrobes:c.wardrobes,activeWardrobe:c.activeWardrobe}},activeCabinet:()=>({...c.activeCabinet?.(),state:c.S}),snapshot:()=>c.sceneSnapshot(),restore:s=>c.restoreScene(s)}
};}
function gestureFixture(c){
 c.history={checkpoint:s=>c.hist.push(s)};
 c.histUI??=()=>{};
 const overrides={...c};
 Object.assign(c,createEditorGestures(dependencies(c)),overrides);
 return c;
}
module.exports={designFixture,gestureFixture,dependencies};
