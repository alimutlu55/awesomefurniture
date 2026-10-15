import type { EditorState } from '../projects/editor-scene';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog';

/** Add an independent shelf in open space, or remove the nearest shelf board.
 * Existing fittings and their positions must survive unchanged. */
export function changeAccordionShelf(state: EditorState, section: number, x: number, y: number, direction: number): boolean {
    const geometry = createWardrobeGeometry(() => state), before = state.dividers;
    const selected = () => { state.sel = section; state.item = -1; state.divider = -1; state.space = null; state.proposal = null; };
    const layouts = () => JSON.stringify(geometry.computeLayout(section).map(q => [q.x0, q.x1, q.relY0, q.relY1]));
    const originalLayout = layouts();
    if (direction > 0) {
        const spaces = geometry.sectionSpaces(section).filter(q => q.x0 !== undefined && q.x1 !== undefined
            && q.x0 <= x && q.x1 >= x && q.w >= 25 && q.hMin >= 32 + PANEL)
            .sort((a, b) => Math.abs((a.y0 + a.y1) / 2 - y) - Math.abs((b.y0 + b.y1) / 2 - y) || b.hMin - a.hMin);
        for (const space of spaces) {
            const base = PLINTH + PANEL, low = space.y0 - base, high = low + space.hMin;
            const shelf = { i: section, orientation: 'horizontal' as const, x0: space.x0!, x1: space.x1!, y: (low + high) / 2,
                area: { x0: space.x0!, x1: space.x1!, y0: low, y1: high } };
            state.dividers = [...before, shelf];
            if (geometry.dividerValid(shelf, before.length) && layouts() === originalLayout) {
                selected(); return true;
            }
            state.dividers = before;
        }
    } else {
        const candidates = before.map((board, index) => ({ board, index }))
            .filter(({ board }) => board.i === section && board.orientation === 'horizontal' && board.x0! <= x && board.x1! >= x)
            .sort((a, b) => Math.abs(a.board.y! + PLINTH + PANEL - y) - Math.abs(b.board.y! + PLINTH + PANEL - y));
        for (const { index } of candidates) {
            state.dividers = before.filter((_, k) => k !== index);
            if (layouts() === originalLayout && state.dividers.every((d, k) => geometry.dividerValid(d, k))) {
                selected(); return true;
            }
            state.dividers = before;
        }
    }
    return false;
}
