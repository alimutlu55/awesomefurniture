const {test}=require('node:test');
const assert=require('node:assert/strict');

test('appearance commands change only their editor and publish one undoable change',()=>{
 const {createAppearanceCommands}=require('../src/application/commands/appearance-commands.js');
 const state={fin:'Oak',doors:'none',open:false,profile:{reach:185,reachStd:185},reachLine:false};
 let checkpoints=0,changed=0;
 const commands=createAppearanceCommands({getDesign:()=>state,effects:{checkpoint(){checkpoints++},changed(){changed++}},run:fn=>{checkpoints++;fn();changed++}});
 commands.setFinish('White');commands.setDoors('hinged');commands.setReachLine(true);
 assert.equal(state.fin,'White');assert.equal(state.doors,'hinged');assert.equal(state.reachLine,true);
 assert.equal(checkpoints,3);assert.equal(changed,3);
});
