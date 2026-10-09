import fs from 'node:fs';
import cases from '../tests/fixtures/planner-review-cases.cjs';
import {designAll,noPlanExplanation} from '../src/domain/planner/selection-planner.ts';
import {scoreLayout} from '../src/domain/planner/layout-score.ts';
import {dnaDistance,DNA_THRESHOLD} from '../src/domain/planner/layout-dna.ts';
import {createEditorState} from '../src/application/projects/editor-state.ts';
import {createDesignCommands} from '../src/application/commands/design-commands.ts';
import {createWardrobeGeometry} from '../src/domain/geometry/wardrobe-geometry.js';
import {createSpaceModel,mergeAdjacentSpaces} from '../src/domain/planner/selection-spaces.ts';
import {upperShelfHeight} from '../src/domain/planner/upper-shelf.ts';
import {storageHeightLimits} from '../src/domain/planner/storage-fitting-limits.ts';
import {MODS,PANEL,PLINTH} from '../src/domain/wardrobe/catalog.js';
const findings=[],rows=[];
const finding=(severity,caseName,plan,message)=>findings.push({severity,caseName,plan,message});
for(const [name,cfg] of cases){
 const before=structuredClone(cfg),start=performance.now(),{plans,pool,skipped}=designAll(cfg);
 if(JSON.stringify(cfg)!==JSON.stringify(before))finding('error',name,'input','generation mutates configuration');
 const row={name,cfg,explanation:plans.length?undefined:noPlanExplanation(cfg),milliseconds:Math.round(performance.now()-start),poolSize:pool.length,skipped,plans:[]};
 if(!plans.length)finding('review',name,'none','No candidate passes every physical, compartment-assignment and quality gate. Review whether no-design feedback is appropriate for this inventory.');
 for(const p of plans){
  const mirrors=p.sections.slice().reverse(),mirrorBoards=p.dividers.map(d=>({...d,i:p.sections.length-1-d.i}));
  const mirrorScore=scoreLayout(mirrors,cfg,mirrorBoards);
  if(JSON.stringify(mirrorScore.breakdown)!==JSON.stringify(p.breakdown))finding('error',name,p.title,'mirroring changes the shared score');
  // Check rendered/application geometry, rather than merely trusting the planner scorer.
  const state=createEditorState();state.w=cfg.w;state.h=cfg.h;state.d=cfg.d;state.profile={...state.profile,...cfg};
  createDesignCommands(()=>state).applyProposal(p);
  const geometry=createWardrobeGeometry(()=>state);
  for(let i=0;i<state.n;i++)if(!geometry.sectionLayoutValid(i))finding('error',name,p.title,'applied geometry invalid in bay '+i);
  const width=p.sections.reduce((n,s)=>n+s.width,0)+(p.sections.length+1)*PANEL;
  if(Math.abs(width-cfg.w)>.03)finding('error',name,p.title,'section widths do not close the cabinet envelope');
  const usable=cfg.h-PLINTH-2*PANEL;
  for(const s of p.sections){
   const rectangles=s.items.map(it=>({x:it.x??0,y:it.y??0,w:it.w??s.width,h:it.h}));
   s.items.forEach((it,i)=>{const r=rectangles[i];
    if(!MODS[it.k]||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<-.01||r.y<-.01||r.x+r.w>s.width+.01||r.y+r.h>usable+.01)finding('error',name,p.title,'raw fitting coordinates outside clear geometry');
    const limits=storageHeightLimits(it,cfg);
    if(it.k!=='void'&&(it.h<limits.min-.03||it.h>limits.max+.03))finding('error',name,p.title,'fitting height violates existing catalog');
    if(rectangles.some((o,j)=>j<i&&r.x<o.x+o.w-.01&&o.x<r.x+r.w-.01&&r.y<o.y+o.h-.01&&o.y<r.y+r.h-.01))finding('error',name,p.title,'raw fitting rectangles overlap');
   });
  }
  if(!cfg.fixedSections){
   const datum=upperShelfHeight(cfg);
   if(datum!==undefined){
    for(const s of p.sections){
     if(s.items.some(it=>(it.y??0)*10<datum-.1&&((it.y??0)+it.h)*10>datum+.1))finding('error',name,p.title,'fitting crosses the planned upper-shelf line');
     const columns=new Map();
     for(const it of s.items.filter(it=>it.k==='seasonal'))columns.set(it.x??0,Math.min(columns.get(it.x??0)??Infinity,(it.y??0)*10));
     if([...columns.values()].some(y=>Math.abs(y-datum)>.1))finding('error',name,p.title,'lowest upper shelves do not share the planned height');
    }
   }
   if(p.sections.some(s=>s.items.some(it=>it.purpose==='accessories')))finding('error',name,p.title,'unrequested accessory filler');
   if(p.archetype==='spare')finding('error',name,p.title,'spare-space recommendation');
   if(p.sections.some(s=>s.items.some(it=>it.k==='void')))finding('error',name,p.title,'generated blank spacer fitting');
   const spaces=mergeAdjacentSpaces(createSpaceModel({...cfg,fixedSections:p.sections,fixedDividers:p.dividers}).spaces);
   if(spaces.some(sp=>sp.h>30&&sp.w>30)&&!p.warnings.some(w=>w.startsWith('Unused cabinet space')))finding('error',name,p.title,'unreported unused cabinet volume');
   if(spaces.some(sp=>sp.h>=150&&sp.w>=250))finding('error',name,p.title,'unassigned usable compartment remains after envelope completion');
   if(spaces.some(sp=>sp.h>30&&sp.w>30))finding('review',name,p.title,'unused cabinet volume; verify it is reported and no filler added');
  }
  if(p.comparison&&(p.comparison.margin<.15-1e-9||plans.some(q=>q!==p&&dnaDistance(p.dna,q.dna)<DNA_THRESHOLD-1e-9)))finding('error',name,p.title,'specialist margin/diversity violated');
  const missed=Object.keys(cfg.needs).filter(k=>cfg.needs[k]>0&&(p.metrics.capacities[k]??0)<1);
  if(missed.length)finding('review',name,p.title,'Entire requested categories unserved: '+missed.join(', '));
  const excess=Object.keys(cfg.needs).filter(k=>cfg.needs[k]>0&&p.metrics.capacities[k]>Math.ceil(cfg.needs[k]*(1+(cfg.growth??15)/100))*2);
  if(excess.length)finding('review',name,p.title,'Capacity above twice planned demand: '+excess.join(', '));
  row.plans.push({title:p.title,archetype:p.archetype,score:p.score,coverage:p.metrics.coverage.total,complete:p.complete,criteria:p.breakdown.criteria,comparison:p.comparison,dna:p.dna,sections:p.sections,dividers:p.dividers});
 }
 rows.push(row);process.stderr.write(name+': '+plans.length+' plans, '+row.milliseconds+'ms\n');
}
const report={generatedAt:new Date().toISOString(),caseCount:cases.length,planCount:rows.reduce((n,r)=>n+r.plans.length,0),findings,rows};
fs.writeFileSync('docs/verification/planner-review.json',JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({caseCount:report.caseCount,planCount:report.planCount,errors:findings.filter(f=>f.severity==='error'),reviewFindings:findings.filter(f=>f.severity==='review').length},null,2)+'\n');
if(findings.some(f=>f.severity==='error'))process.exitCode=1;
