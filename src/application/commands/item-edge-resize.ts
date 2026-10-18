import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { ItemResizeSession, ItemResizeTarget } from './command-types';

/** The section as it would be once an edge of one fitting has moved to `target`, or null when the target does not fit
 * that edge. The top edge changes the height (what is above it follows); the bottom edge pins every fitting where it
 * stands and gives this one its new bottom and height; a side edge pins them and gives it its new width and place. */
export function sectionAfterEdgeResize(a: ItemResizeSession, target: ItemResizeTarget): EditorItem[] | null {
    const sec = structuredClone(a.original), it = sec[a.index];
    if (!it) return null;
    const pin = () => sec.forEach((o, j) => o.y = a.layout[j]!.relY0);
    if (a.edge === 'top' || a.edge === 'bottom') {
        if (!('h' in target) || (a.edge === 'bottom' && target.y === undefined)) return null;
        if (a.edge === 'bottom') { pin(); it.y = target.y!; }
        it.h = target.h;
        return sec;
    }
    if (!('w' in target)) return null;
    pin();
    it.w = target.w;
    it.x = target.x;
    delete it.ax;
    if (target.w >= a.g.bw - .05) { delete it.w; delete it.x; }
    return sec;
}
