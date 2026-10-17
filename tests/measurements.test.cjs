// Run with: node --test tests/measurements.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {createWardrobeGeometry}=require('../src/domain/geometry/wardrobe-geometry.js');
function fixture(sections, extra = {}) {
  const S={w:200,h:230,d:60,n:3,wt:[100,100,100],secs:sections,...extra};
  const rules=createWardrobeGeometry(()=>S);
  const get=(i,j)=>rules.itemMeasurements(i,j);get.space=i=>rules.sectionSpaceMeasurements(i);return get;
}
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<.001, `${actual} should equal ${expected}`);
test('bottom drawer: outer coordinates, internal top/base and XYZ are distinct', () => {
  const m=fixture([[{k:'drawer',h:22}],[],[]])(0,0);
  near(m.w,64.3); near(m.h,22); near(m.dep,58);
  near(m.x0,1.8); near(m.y0,9.8); near(m.z0,.6); near(m.z1,58.6); // from the back board (0.6) to the 1.4 cm fitting setback
  near(m.top,196.4); near(m.bottom,0); near(m.freeTop,196.4); near(m.freeBelow,0);
});
test('stacked drawer: top distance includes other items but free space does not', () => {
  const m=fixture([[{k:'drawer',h:22},{k:'shelf',h:30}],[],[]])(0,0);
  near(m.top,196.4); near(m.freeTop,0);
  const upper=fixture([[{k:'drawer',h:22},{k:'shelf',h:30}],[],[]])(0,1);
  near(upper.bottom,22); near(upper.y0,31.8); near(upper.freeBelow,0);
});
test('side by side items do not obstruct one another; centered bridge sees actual lower gap', () => {
  const get=fixture([[{k:'drawer',w:25,ax:'l',h:22},{k:'shelf',w:25,ax:'r',h:40},{k:'shelf',h:30}],[],[]]);
  const short=get(0,0), bridge=get(0,2);
  near(short.freeTop,18); near(short.freeBelow,0); near(bridge.bottom,40); near(bridge.freeBelow,0);
});
test('resized cabinets and narrow aligned items retain correct coordinates', () => {
  const m=fixture([[],[{k:'drawer',w:30,ax:'r',h:25}],[]],{h:250,d:45})(1,0);
  near(m.dep,43); near(m.gapR,0); near(m.gapL,34.3);
  near(m.top,213.4); near(m.bottom,0); near(m.x0,102.2);
});
test('missing item gives no measurement record', () => assert.equal(fixture([[],[],[]])(0,0),null));

test('selected empty space uses internal width, height and depth',()=>{
 const m=fixture([[],[],[]]).space(2);near(m.w,64.2);near(m.h,218.4);near(m.dep,58);near(m.y0,9.8);near(m.y1,228.2);
});
test('selected free space excludes occupied height and follows resized cabinets',()=>{
 const m=fixture([[{k:'drawer',h:22},{k:'shelf',h:30}],[],[]],{h:250,d:45}).space(0);near(m.h,186.4);near(m.dep,43);near(m.y0,61.8);
});
