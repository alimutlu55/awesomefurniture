import type { Board } from '../drawings/cabinet-boards';
import type { Hole } from './make-joints';
import { boardPolygon } from './back-construction';

/** Signed distance to the actual front-elevation polygon (positive inside), cm. */
function clearance(b:Board,x:number,y:number):number {
 const polygon=boardPolygon(b);let inside=false,nearest=Infinity;
 polygon.forEach((p,i)=>{
  const q=polygon[(i+1)%polygon.length]!,dx=q.x-p.x,dy=q.y-p.y,den=dx*dx+dy*dy;
  const t=den ? Math.max(0,Math.min(1,((x-p.x)*dx+(y-p.y)*dy)/den)) : 0;
  nearest=Math.min(nearest,Math.hypot(x-p.x-t*dx,y-p.y-t*dy));
  if((p.y>y)!==(q.y>y) && x<(q.x-p.x)*(y-p.y)/(q.y-p.y)+p.x) inside=!inside;
 });
 return nearest<1e-9 ? 0 : inside ? nearest : -nearest;
}
/** Material bounds in the drill's actual axes; face bores use the polygon, not its box. */
export function boreMaterial(b:Board,h:Hole): {kind:'edge'|'breakout';gap:number}[] {
 const min=[b.x0,b.y0,b.z0],max=[b.x1,b.y1,b.z1],out:{kind:'edge'|'breakout';gap:number}[]=[];
 const radius=h.d/20;
 const outside=Math.min(...h.at.map((v,a)=>Math.min(v-min[a]!,max[a]!-v)),clearance(b,h.at[0],h.at[1]));
 if(outside < -1e-9) out.push({kind:'edge',gap:outside*10});
 if(h.axis!==2) {
  const gap=Math.min(...h.at.flatMap((v,a)=>a===h.axis ? [] : [v-min[a]!-radius,max[a]!-v-radius]));
  if(gap < -1e-9 && outside>=-1e-9) out.push({kind:'edge',gap:Number((gap*10).toPrecision(12))});
 }
 if(h.axis===2) {
  const gap=clearance(b,h.at[0],h.at[1])-radius;
  if(gap < -1e-9 && outside>=-1e-9) out.push({kind:'edge',gap:gap*10});
 }
 if(h.depth>0) {
  const end=[...h.at];end[h.axis]!+=h.sign*h.depth/10;
  const remaining=h.sign>0 ? max[h.axis]!-end[h.axis]! : end[h.axis]!-min[h.axis]!;
  if(remaining < -1e-9) out.push({kind:'breakout',gap:remaining*10});
  else if(h.axis!==2 && clearance(b,end[0]!,end[1]!) < -1e-9) out.push({kind:'breakout',gap:clearance(b,end[0]!,end[1]!)*10});
 }
 return out;
}
