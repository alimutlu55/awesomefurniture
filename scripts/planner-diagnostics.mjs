import { designAll } from '../src/domain/planner/selection-planner.ts';
import { dnaDistance } from '../src/domain/planner/layout-dna.ts';
const config={w:200,h:230,d:60,reach:185,longDrop:160,growth:15,upper:'fill',drawers:'auto',density:'comfort',needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30}};
const cases=[
 ['fold-heavy',{...config,needs:{short:6,long:0,pants:10,folded:70,shoes:2,small:30}}],
 ['hang-heavy',{...config,h:260,reach:210,needs:{short:40,long:8,pants:4,folded:8,shoes:2,small:10}}],
 ['shoe-heavy',{...config,needs:{short:4,long:0,pants:2,folded:10,shoes:35,small:8}}],
 ['tiny',{...config,w:80,h:180,reach:150}],
 ['huge',{...config,w:350,h:280,reach:210}],
];
const results=cases.map(([name,cfg])=>{
 const start=performance.now(),{plans,pool,skipped}=designAll(cfg);
 return {name,cfg,milliseconds:Math.round(performance.now()-start),poolSize:pool.length,skipped,
  plans:plans.map(p=>({title:p.title,archetype:p.archetype,score:p.score,coverage:p.metrics.coverage.total,comparison:p.comparison,dna:p.dna,floors:p.breakdown.criteria,sections:p.sections,dividers:p.dividers,selectionNote:p.selectionNote})),
  distances:plans.map(a=>plans.map(b=>+dnaDistance(a.dna,b.dna).toFixed(4)))};
});
process.stdout.write(JSON.stringify(results,null,2)+'\n');
