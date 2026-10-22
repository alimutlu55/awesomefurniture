import { getDecor } from '../materials/decor-catalog';
import type { EditorDesign } from './editor-design';
import { PANEL, PLINTH } from './catalog.js';
import { ceilingMin, ceilingPieces, resolveShape } from './shape/wardrobe-shape';

/** A wardrobe door leaf: its thickness, how far its middle stands in front of the carcass, and the gap left under the
 * wardrobe's top. Centimetres. */
export const DOOR = { thickness: 1.6, standoff: 1.2, topGap: .2 } as const;

export const doorThickness = (design: Pick<EditorDesign, 'materials' | 'doors'>) =>
  design.materials && (design.doors !== 'glass' || getDecor(design.materials.frontDecorId).category === 'glass_mirror') ? getDecor(design.materials.frontDecorId).thicknessMm / 10 : DOOR.thickness;

/** Front coordinates, measured from the left outer face and the floor.
 * An infinite cap means the leaf follows the outer roof profile. */
export interface DoorArea { x0: number; x1: number; y0: number; y1: number }
export type DoorHang = 'auto' | 'left' | 'right';

/** Which side a wardrobe door leaf hinges on: the cabinet's chosen hang ('left' puts the handle on the right;
 * 'right' on the left), or by default the side nearer the wardrobe's end so handles meet towards the middle. */
export function doorHingeSide(area: Pick<DoorArea, 'x0' | 'x1'>, design: Pick<EditorDesign, 'w' | 'doorHang'>): 'left' | 'right' {
    if (design.doorHang === 'left' || design.doorHang === 'right') return design.doorHang;
    return (area.x0 + area.x1) / 2 <= design.w / 2 ? 'left' : 'right';
}

/** Only structural boards that span a compartment divide its doors. Ordinary
 * fittings do not, and a free-standing partial divider cannot support a seam.
 * Clear bounds follow board faces; front bounds meet at board centre lines. */
export function cabinetDoorAreas(design: EditorDesign, widths: readonly number[]): DoorArea[] {
    const pieces = ceilingPieces(resolveShape(design)), result: DoorArea[] = [];
    let origin = PANEL;
    widths.forEach((width, section) => {
        const boards = design.dividers.filter(d => d.i === section);
        type Clear = { x0: number; x1: number; y0: number; y1: number };
        const visit = (clear: Clear, front: DoorArea, remaining: typeof boards): void => {
            const index = remaining.findIndex(d => {
                if (d.orientation === 'horizontal') {
                    return d.y !== undefined && d.x0 !== undefined && d.x1 !== undefined
                        && d.x0 <= clear.x0 + .02 && d.x1 >= clear.x1 - .02
                        && d.y - PANEL / 2 > clear.y0 + .02
                        && d.y + PANEL / 2 < Math.min(clear.y1, ceilingMin(pieces, origin + clear.x0, origin + clear.x1) - PLINTH - PANEL) - .02;
                }
                if (d.x === undefined || d.y0 === undefined || d.y1 === undefined) return false;
                const roof = ceilingMin(pieces, origin + d.x - PANEL / 2, origin + d.x + PANEL / 2) - PLINTH - PANEL;
                return d.x - PANEL / 2 > clear.x0 + .02 && d.x + PANEL / 2 < clear.x1 - .02
                    && d.y0 <= clear.y0 + .02 && (d.want ?? d.y1) >= Math.min(clear.y1, roof) - .02;
            });
            if (index < 0) { result.push(front); return; }
            const board = remaining[index]!, rest = remaining.filter((_, i) => i !== index);
            if (board.orientation === 'vertical') {
                const x = board.x!, seam = origin + x;
                visit({ ...clear, x1: x - PANEL / 2 }, { ...front, x1: seam - .1 }, rest);
                visit({ ...clear, x0: x + PANEL / 2 }, { ...front, x0: seam + .1 }, rest);
            } else {
                const y = board.y!, seam = PLINTH + PANEL + y;
                visit({ ...clear, y1: y - PANEL / 2 }, { ...front, y1: seam - .1 }, rest);
                visit({ ...clear, y0: y + PANEL / 2 }, { ...front, y0: seam + .1 }, rest);
            }
        };
        visit({ x0: 0, x1: width, y0: 0, y1: Infinity },
            { x0: origin - PANEL + .1, x1: origin + width - .1, y0: PLINTH + .2, y1: Infinity }, boards);
        origin += width + PANEL;
    });
    return result;
}
