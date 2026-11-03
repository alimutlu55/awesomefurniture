import type { MakePiece } from './make-parts';
import { fittedAt, type Playhead, type Timeline } from './make-timeline';

/** Mechanisms without individual fasteners still have an explicit, continuous installation path.
 * Frame engages the runners first; baskets are hooked on after the door is attached and adjusted.
 */
export function cargoFittedAt(piece: MakePiece, tl: Timeline, ph: Playhead, item: number): number | null {
 const f=piece.fittings[item]!;
 if(!f.size?.includes('cargo') || f.kind!=='support' && f.kind!=='rail') return fittedAt(tl,ph,item,f.kind);
 const k=tl.itemStep[item]!,s=tl.steps[k]!;
 if(ph.t<s.place[0])return null;
 if(ph.t>=s.place[1])return 1;
 const items=piece.steps[k]!.items.filter(i=>piece.fittings[i]!.kind===f.kind),index=items.indexOf(item);
 const elapsed=(ph.t-s.place[0])/(s.place[1]-s.place[0]);
 const progress=f.kind==='rail' ? (elapsed-.2)/.8 : elapsed;
 const local=progress*items.length-index;
 return local<0 ? null : Math.max(0,Math.min(1,local));
}

/** First lift and align the chassis ahead of the opening, then engage it along the runner axis. */
export function cargoFramePlacement(start: readonly number[], home: readonly number[], p: number, clearance: number) {
 const unit=(v:number)=>Math.max(0,Math.min(1,v)),ease=(v:number)=>{const u=unit(v);return u*u*(3-2*u);};
 const align=ease(p/.6),insert=ease((p-.6)/.4);
 const at=home.map((v,i)=>start[i]!+(v+(i===2?clearance:0)-start[i]!)*align-(i===2?clearance*insert:0));
 at[1]!+=20*Math.sin(Math.PI*align);
 return {at,align};
}
