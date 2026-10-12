const {test}=require('node:test');const assert=require('node:assert/strict');
const {railLayout}=require('../src/presentation/viewport/garment-rail.js');
const {GARMENT_PHOTOS}=require('../src/presentation/viewport/item-models.ts');
const extent=o=>[o.hookX-o.width*o.photo.hook,o.hookX+o.width*(1-o.photo.hook)];
test('a rail\'s garments are stable for a seed, inside the bay, and never one family twice in a row',()=>{
 const a=railLayout(GARMENT_PHOTOS,-40,40,105,7),b=railLayout(GARMENT_PHOTOS,-40,40,105,7),c=railLayout(GARMENT_PHOTOS,-40,40,105,8);
 assert.deepEqual(a.map(o=>[o.photo.name,o.hookX,o.colour]),b.map(o=>[o.photo.name,o.hookX,o.colour]),'same seed, same wardrobe');
 assert.notDeepEqual(a.map(o=>o.photo.name),c.map(o=>o.photo.name),'another bay, another mix');
 assert.ok(a.length>=4,'an 80 cm rail holds several garments: '+a.length);
 for(const o of a){const [l,r]=extent(o);assert.ok(l>=-40.6&&r<=40.6,'inside the bay: '+[l,r]);assert.ok(o.length<=101,'clears what is below');}
 for(let i=1;i<a.length;i++)assert.notEqual(a[i].photo.family,a[i-1].photo.family);
});
test('hook spacing follows the garments\' thickness and a tall rail holds the long garments',()=>{
 const a=railLayout(GARMENT_PHOTOS,-200,200,105,3);
 for(let i=1;i<a.length;i++)assert.ok(Math.abs(a[i].hookX-a[i-1].hookX-((a[i].thickness+a[i-1].thickness)/2+5.5))<1e-9);
 const tall=railLayout(GARMENT_PHOTOS,-60,60,170,3);
 assert.ok(tall.every(o=>o.photo.length>=100||o.photo.family==='trousers'),tall.map(o=>o.photo.name).join());
});
