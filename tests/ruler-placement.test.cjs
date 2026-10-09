const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createCabinetRenderer}=require('../src/presentation/viewport/cabinet-renderer.js');
const ctx=createCabinetRenderer({dom:require('./helpers/dom-fixture.cjs').domFixture(), model:{activeCabinet:()=>({state:{}})},settings:{budget:900}});
function place(axis,a,b,w=60,h=18,bounds={left:0,right:800,bottom:600}){return ctx.rulerScreenPlacement(a,b,axis,w,h,bounds)}
test('compact rulers stay close to item edges and labels stay beside their own line',()=>{
 let q=place('width',{x:200,y:200},{x:300,y:200});assert.equal(q.x,(q.a.x+q.b.x)/2);assert.equal(q.y,(q.a.y+q.b.y)/2-16);
 q=place('height',{x:300,y:100},{x:300,y:200});assert.equal(q.a.x,308);assert.equal(q.x,(q.a.x+q.b.x)/2+44);assert.equal(q.y,q.a.y+(q.b.y-q.a.y)*.28);
});
test('viewport adjustments translate label and ruler together rather than detaching the value',()=>{
 const q=place('height',{x:780,y:100},{x:780,y:200});assert.equal(q.x,770);assert.equal(q.x-q.a.x,44);assert.equal(q.b.y-q.a.y,100);
});

test('depth and width rulers use small fixed gaps at any zoom level',()=>{
 let q=place('depth',{x:200,y:100},{x:220,y:150});assert.equal(q.a.x,192);assert.equal(q.b.x,212);
 q=place('width',{x:200,y:200},{x:500,y:200});assert.equal(q.a.y,206);assert.equal(q.b.y,206);
});
