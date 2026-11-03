import { constructionOf } from './make-construction';
import type { Board } from '../drawings/cabinet-boards';
import type { EditorDesign } from '../wardrobe/editor-design';
import { BACK_PANEL, BACK_REAR_LIP, plinthOf } from '../wardrobe/carcass';
import { PANEL } from '../wardrobe/catalog.js';
import { ceilingPieces, ceilingPolyline, resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { thinAxis } from './make-measures';

/** Nominal joinery, cm: 6 mm engagement; a captured groove has a 6 mm rear lip. */
export const BACK_JOINERY = { engagement: .6, lip: BACK_REAR_LIP } as const;

/** Stock envelopes. Their intentional overlap with the back is removed by backMachining. */
export function backBoards(boards: readonly Board[], design: EditorDesign): Board[] {
  const lip = constructionOf(design).back === 'grooved' ? BACK_JOINERY.lip : 0, e = BACK_JOINERY.engagement;
  const roof = ceilingPieces({ ...resolveShape(design), back: undefined });
  const stock = boards.map(b => {
    if (b.name === 'Back') {
      const x0 = b.x0 === PANEL ? b.x0 - e : b.x0, x1 = Math.abs(b.x1 - (design.w - PANEL)) < 1e-9 ? b.x1 + e : b.x1;
      const y0 = plinthOf(design) + PANEL - e, top = ceilingPolyline(roof, x0, x1).map(p => ({ x: p.x, y: p.y + e }));
      const y1 = Math.max(...top.map(p => p.y)), outline = [{ x: x0, y: y0 }, { x: x1, y: y0 }, ...top.reverse()];
      const shaped = top.some(p => Math.abs(p.y - y1) > 1e-9);
      return { ...b, x0, x1, y0, y1, z0: lip, z1: lip + BACK_PANEL,
        outline: shaped ? outline : undefined, cut: { length: y1 - y0, width: x1 - x0, thickness: BACK_PANEL } };
    }
    const z0 = b.name === 'Base' || lip > 0 && b.name === 'Partition' ? 0 : b.stock === 'carcass' && Math.abs(b.z0 - BACK_PANEL) < 1e-9 ? b.z0 + lip : b.z0;
    if (z0 === b.z0) return b;
    const depth = b.z1 - z0, old = b.z1 - b.z0, cut = { ...b.cut };
    if (thinAxis(b) !== 'z') {
      if (Math.abs(cut.width - old) < 1e-9) cut.width = depth; else cut.length = depth;
    }
    return { ...b, z0, cut };
  });
  return stock.map(b => {
    if (b.stock !== 'carcass') return b;
    const machining = stock.filter(back => back.name === 'Back').flatMap(back => {
      const z0=Math.max(b.z0,back.z0),z1=Math.min(b.z1,back.z1), outline=clipPolygon(boardPolygon(back),boardPolygon(b));
      const area=Math.abs(outline.reduce((s,p,i)=>{const q=outline[(i+1)%outline.length]!;return s+p.x*q.y-q.x*p.y;},0))/2;
      return z1-z0>1e-9 && area>1e-9 ? [{outline,z0,z1,kind:lip ? 'groove' as const : 'rebate' as const}] : [];
    });
    return machining.length ? {...b,machining} : b;
  });
}

export interface Point { readonly x: number; readonly y: number }
export const boardPolygon = (b: Board): readonly Point[] => b.outline ?? [
  { x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
/** Clip the back profile against a convex support board (roof strip, side, base). */
export function clipPolygon(subject: readonly Point[], clip: readonly Point[]): Point[] {
  let out = [...subject];
  const area = clip.reduce((s,p,i) => { const q=clip[(i+1)%clip.length]!; return s+p.x*q.y-q.x*p.y; },0), sign = area >= 0 ? 1 : -1;
  clip.forEach((a,i) => {
    const b=clip[(i+1)%clip.length]!, cross=(p:Point)=>sign*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));
    const input=out; out=[];
    input.forEach((p,j)=>{
      const q=input[(j+1)%input.length]!, cp=cross(p),cq=cross(q);
      if(cp>=-1e-10) out.push(p);
      if((cp>=0)!==(cq>=0)) { const t=cp/(cp-cq);out.push({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)}); }
    });
  });
  return out;
}

