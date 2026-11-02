import { cabinetDoorLeaves } from '../../domain/wardrobe/door-layout';
import { leafKey, MAX_LEAVES, type LeafSettings } from '../../domain/wardrobe/front-styles';
import type { EditorState } from '../projects/editor-scene';

type Ports = {
    getDesign(): EditorState;
    /** The cabinet's bay widths, as the doors are laid out on them. */
    widths(): readonly number[];
    run(fn: () => void): void;
};
/**
 * One door leaf's own settings, chosen on the leaf: which side it hangs on, and how many leaves its opening is split
 * into. Leaves are named by their front-styles key (bay.row.leaf). Each change is one undo step, written in the design's
 * fronts (`fronts.leaves`) as a saved design reads them.
 */
export function createFrontCommands({ getDesign, widths, run }: Ports) {
    const leafOf = (key: string) => getDesign().doors === 'none' ? undefined : cabinetDoorLeaves(getDesign(), widths()).find(l => leafKey(l.bay, l.row, l.leaf) === key);
    const write = (edit: (leaves: Record<string, LeafSettings>) => void) => run(() => {
        const design = getDesign(), leaves = { ...design.fronts?.leaves };
        edit(leaves);
        design.fronts = { ...design.fronts, leaves };
    });
    /** Hangs the leaf on its other side: its hinges move to the other edge, its handle to the edge they left. */
    function flipLeafHinge(key: string) {
        const leaf = leafOf(key);
        if (!leaf) return false;
        write(leaves => { leaves[key] = { ...leaves[key], hinge: leaf.hinge === 'left' ? 'right' : 'left' }; });
        return true;
    }
    /** Splits the leaf's opening into `count` leaves (1 to MAX_LEAVES). The settings of leaves that are gone go with
     * them. False when nothing changes or the count is not allowed. */
    function setOpeningLeaves(key: string, count: number) {
        const leaf = leafOf(key);
        if (!leaf || !Number.isInteger(count) || count < 1 || count > MAX_LEAVES || count === leaf.of) return false;
        const opening = leafKey(leaf.bay, leaf.row);
        write(leaves => {
            leaves[opening] = { ...leaves[opening], leaves: count };
            for (let n = count; n < MAX_LEAVES; n++) delete leaves[leafKey(leaf.bay, leaf.row, n)];
        });
        return true;
    }
    return { flipLeafHinge, setOpeningLeaves };
}
