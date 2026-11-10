import type { MakePiece } from './make-parts';
import { fittedAt, type Playhead, type Timeline } from './make-timeline';

/** Mechanisms without individual fasteners still have an explicit, continuous installation path.
 * Baskets are fitted outside before the complete mechanism engages the cabinet runners.
 */
export function cargoFittedAt(piece: MakePiece, tl: Timeline, ph: Playhead, item: number): number | null {
 const f=piece.fittings[item]!;
 if(!f.size?.includes('cargo') || f.kind!=='support' && f.kind!=='rail') return fittedAt(tl,ph,item,f.kind);
 const k=tl.itemStep[item]!,s=tl.steps[k]!;
 if(ph.t<s.place[0])return null;
 if(ph.t>=s.place[1])return 1;
 const items=piece.steps[k]!.items.filter(i=>piece.fittings[i]!.kind===f.kind),index=items.indexOf(item);
 const elapsed=(ph.t-s.place[0])/(s.place[1]-s.place[0]);
 const local=elapsed*items.length-index;
 return local<0 ? null : Math.max(0,Math.min(1,local));
}
