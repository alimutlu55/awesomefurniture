import type { EditorScene } from '../projects/editor-scene';
import { createSceneCommands } from './scene-commands';
import { createDesignCommands } from './design-commands';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry';
import { depthForFitting } from '../../domain/wardrobe/carcass';
import { boundaryControlHeight, setBoundaryControlHeight } from '../../domain/studio/surface-boundary';
import { roomHeight, wallFace } from '../../domain/studio/studio';
import { setInsideLength, setWallSize, setOpeningSize, moveOpening, moveOpening2D } from '../../domain/studio/studio-edit';
import { edgeHeight, outerEdgeHeight, setOuterEdgeHeight } from '../../domain/studio/ceiling-edge';
import { moveCeilingPoint, setCeilingDepth } from '../../domain/studio/studio-ceiling';
import { fixtureFromEnd, setFixtureSize } from '../../domain/studio/fixtures/fixture-edit';
import { placeFromEnd } from '../../domain/studio/fixtures/fixture-setup';

export type SceneMeasurement =
    | { kind: 'reach' }
    | { kind: 'item-size'; section: number; index: number; axis: 'w' | 'h' | 'd' }
    | { kind: 'item-gap'; section: number; index: number; side: 'top' | 'bottom' }
    | { kind: 'board-size'; index: number; axis: 'w' | 'h' | 'd' }
    | { kind: 'board-gap'; index: number; side: 'before' | 'after' }
    | { kind: 'studio'; selection: 'wall' | 'opening' | 'ceiling' | 'fixture'; id: string; field: string };

/** Domain-specific adapters for the reusable badge. Every mutation is silent;
 * its caller owns preview rollback and the single gesture checkpoint. */
export function createSceneMeasurements(scene: () => EditorScene) {
    const state = () => scene().wardrobes.find(c => c.id === scene().activeWardrobe)!.state;
    const geometry = createWardrobeGeometry(state), design = createDesignCommands(state), commands = createSceneCommands(scene);
    function read(ref: SceneMeasurement): number | null {
        if (ref.kind === 'studio') {
            const room = scene().studio;
            if (!room) return null;
            if (ref.field.startsWith('b') && (ref.selection === 'wall' || ref.selection === 'ceiling'))
                return boundaryControlHeight(room, ref.selection, ref.id, Number(ref.field.slice(1)));
            if (ref.selection === 'wall') {
                const wall = room.walls.find(w => w.id === ref.id);
                return !wall ? null : ref.field === 'length' ? wallFace(room, wall)?.length ?? null
                    : ref.field === 'height' ? wall.height : ref.field === 'thickness' ? wall.thickness : null;
            }
            if (ref.selection === 'fixture') {
                const f = room.fixtures?.find(x => x.id === ref.id);
                return !f ? null : ref.field === 'left' || ref.field === 'right' ? fixtureFromEnd(room, f, ref.field)
                    : ref.field === 'width' || ref.field === 'depth' || ref.field === 'height' ? f[ref.field] : null;
            }
            if (ref.selection === 'ceiling') {
                const ceiling = room.ceilings?.find(c => c.id === ref.id);
                if (!ceiling) return null;
                if (ref.field === 'outer') return outerEdgeHeight(ceiling);
                if (ref.field === 'depth') return ceiling.depth;
                const point = ceiling.profile[Number(ref.field.slice(1))];
                return point ? Math.min(roomHeight(room), edgeHeight(ceiling, point.y)) : null;
            }
            const opening = room.openings.find(o => o.id === ref.id), wall = opening && room.walls.find(w => w.id === opening.wall);
            const face = wall && wallFace(room, wall);
            if (!opening || !wall || !face) return null;
            return ref.field === 'left' ? opening.offset - opening.width / 2 - face.start
                : ref.field === 'right' ? face.end - opening.offset - opening.width / 2
                    : ref.field === 'width' ? opening.width : ref.field === 'height' ? opening.height
                        : ref.field === 'sill' ? opening.sill : ref.field === 'top' ? wall.height - opening.sill - opening.height : null;
        }
        if (!scene().wardrobes.length) return null;
        if (ref.kind === 'reach') return scene().maxReach ?? null;
        // The net gap to what is really above or below the fitting, not to the carcass top or base.
        if (ref.kind === 'item-gap') return geometry.itemMeasurements(ref.section, ref.index)?.[ref.side === 'top' ? 'gapAbove' : 'gapBelow'] ?? null;
        if (ref.kind === 'board-gap') return geometry.dividerMeasurements(ref.index)?.[ref.side] ?? null;
        if (ref.kind === 'item-size') {
            const item = geometry.itemMeasurements(ref.section, ref.index);
            return !item ? null : ref.axis === 'd' ? item.dep : item[ref.axis];
        }
        const board = geometry.dividerMeasurements(ref.index);
        return !board ? null : ref.axis === 'w' ? board.width : ref.axis === 'h' ? board.height : board.depth;
    }
    function apply(ref: SceneMeasurement, value: number): boolean {
        if (!Number.isFinite(value) || value < 0 || read(ref) === null) return false;
        if (ref.kind === 'studio') return commands.editStudio(room => {
            if (ref.field.startsWith('b') && (ref.selection === 'wall' || ref.selection === 'ceiling'))
                return setBoundaryControlHeight(room, ref.selection, ref.id, Number(ref.field.slice(1)), value);
            if (ref.selection === 'wall') return ref.field === 'length' ? setInsideLength(room, ref.id, value)
                : setWallSize(room, ref.id, { [ref.field]: value });
            if (ref.selection === 'fixture') return ref.field === 'left' || ref.field === 'right' ? placeFromEnd(room, ref.id, ref.field, value)
                : setFixtureSize(room, ref.id, { [ref.field]: value });
            if (ref.selection === 'ceiling') {
                if (ref.field === 'outer') return setOuterEdgeHeight(room, ref.id, value);
                if (ref.field === 'depth') return setCeilingDepth(room, ref.id, value);
                const k = Number(ref.field.slice(1)), point = room.ceilings?.find(c => c.id === ref.id)?.profile[k];
                return point ? moveCeilingPoint(room, ref.id, k, point.t, value - (room.ceilings?.find(c => c.id === ref.id)?.edgeRise ?? 0)) : null;
            }
            const o = room.openings.find(o => o.id === ref.id)!, wall = room.walls.find(w => w.id === o.wall)!;
            if (!o || !wall) return null;
            if (ref.field === 'sill' || ref.field === 'top') {
                const sill = ref.field === 'sill' ? value : wall.height - o.height - value;
                return moveOpening2D(room, ref.id, o.offset, sill);
            }
            if (ref.field !== 'left' && ref.field !== 'right') return setOpeningSize(room, ref.id, { [ref.field]: value });
            const face = wallFace(room, wall);
            if (!face) return null;
            const offset = ref.field === 'left' ? face.start + value + o.width / 2 : face.end - value - o.width / 2;
            return moveOpening(room, ref.id, Math.min(face.end - o.width / 2, Math.max(face.start + o.width / 2, offset)));
        }, false, true);
        const before = read(ref);
        if (ref.kind === 'reach') commands.setMaxReach(value, false);
        else if (ref.kind === 'item-gap') {
            // setItemClearance places the fitting by its distance to the carcass top or base; shift that by the change in net gap.
            const m = geometry.itemMeasurements(ref.section, ref.index)!, net = ref.side === 'top' ? m.gapAbove : m.gapBelow;
            design.setItemClearance(ref.section, ref.index, ref.side, m[ref.side] - net + value);
        }
        else if (ref.kind === 'board-gap') design.setDividerClearance(ref.index, ref.side, value);
        else if (ref.axis === 'd') commands.setCabinetSize('d', depthForFitting(value), false);
        else if (ref.kind === 'item-size') {
            state().sel = ref.section; state().item = ref.index;
            if (ref.axis === 'w') design.setItemW(value); else design.setItemH(value);
            if (!geometry.sectionLayoutValid(ref.section)) return false;
        } else {
            const board = state().dividers[ref.index]!;
            if (ref.axis === 'h') design.setDividerHeight(ref.index, value);
            else {
                if (board.orientation !== 'horizontal' || value < 25) return false;
                board.x1 = board.x0! + value;
            }
            if (!geometry.dividerValid(state().dividers[ref.index]!, ref.index)
                || !geometry.sectionLayoutValid(board.i)) return false;
        }
        return read(ref) !== before;
    }
    return { read, apply, settle: () => commands.followCeilings(true) };
}
