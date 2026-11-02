import { leafKey, parseLeafKey } from '../../domain/wardrobe/front-styles';
import { cabinetDoorLeaves } from '../../domain/wardrobe/door-layout';
import { chosenLeaf, type createSelectionState } from './selection-state.js';
import type { createEditorModel } from '../../application/projects/editor-model.js';
import type { createDesignCommands } from '../../application/commands/design-commands';
import { doorFacts, doorFactsHtml } from './door-facts';
import { drawingInputOf } from '../drawings/drawing-release';

type Model = Pick<ReturnType<typeof createEditorModel>, 'scene' | 'activeCabinet'>;
type SelectionState = ReturnType<typeof createSelectionState>;
export interface LeafActionPorts {
    readonly selectionState: SelectionState;
    readonly model: Model;
    readonly commands: Pick<ReturnType<typeof createDesignCommands>, 'flipLeafHinge' | 'setOpeningLeaves'>;
    /** Opens a section of the settings panel, as the toolbar's own tools do. */
    readonly openControls: (key: string) => void;
    readonly $: (selector: string) => HTMLElement | null;
}

/** The chosen leaf's key in the active wardrobe, or null. */
const chosen = ({ selectionState, model }: Pick<LeafActionPorts, 'selectionState' | 'model'>) =>
    model.scene.wardrobes.length ? chosenLeaf(selectionState, model.scene.activeWardrobe, model.activeCabinet().state) : null;
/** The toolbar's context while a door leaf is chosen ('leaf'), else undefined. */
export const leafContext = (selectionState: SelectionState, model: Model) => chosen({ selectionState, model }) ? 'leaf' as const : undefined;

/**
 * Runs a chosen leaf's tool (contextual-actions `leaf` and its Leaves menu): hang it on its other side, split its opening
 * into that many leaves (the leaf stays chosen, or the last one left when it is gone), or open the handle choice in
 * Fronts. False when `key` is not a leaf tool or no leaf is chosen.
 */
export function leafAction(key: string, ports: LeafActionPorts): boolean {
    const key0 = chosen(ports), leaf = key0 ? parseLeafKey(key0) : undefined;
    if (!key0 || !leaf || !(key.startsWith('leaf-') || key.startsWith('leaves-'))) return false;
    if (key === 'leaf-hinge') ports.commands.flipLeafHinge(key0);
    else if (key.startsWith('leaves-')) {
        // The leaf that stays chosen is set before the command redraws the doors (as the last one left when it goes).
        const count = Number(key.slice('leaves-'.length)), was = ports.selectionState.leaf;
        if (was && (leaf.leaf ?? 0) >= count) ports.selectionState.leaf = { ...was, key: leafKey(leaf.bay, leaf.row, Math.max(0, count - 1)) };
        if (!ports.commands.setOpeningLeaves(key0, count)) ports.selectionState.leaf = was;
    } else if (key === 'leaf-handle') {
        const left = ports.$('#left');
        if (!(left?.dataset.contextSection === 'fronts' && left.closest('.props-open'))) ports.openControls('fronts');
        ports.$('#fins')?.querySelector<HTMLElement>('[data-handle="kind"]')?.focus({ preventScroll: false });
    }
    return true;
}

/**
 * Shows the chosen piece open (contextual-actions `open-doors`): its doors swing to their hinges' angle and its drawers
 * slide out, as Make opens a piece; pressed again, it closes them. Not an undo step. False for any other key.
 */
export function openAction(key: string, { model, renderState }: { readonly model: Model; readonly renderState: { showOpen: object | null } }): boolean {
    if (key !== 'open-doors' || !model.scene.wardrobes.length) return false;
    const state = model.activeCabinet().state, shown = !!state.open && renderState.showOpen === state;
    state.open = !shown;
    renderState.showOpen = shown ? null : state;
    return true;
}

/** The chosen leaf's facts (contextual-actions `leaf-facts`, P1-11): a small drawing and its numbers, for the toolbar's
 * own popover. Nothing for any other key. */
export function leafControls(key: string, { selectionState, model, document }: Pick<LeafActionPorts, 'selectionState' | 'model'> & { readonly document: Pick<Document, 'createElement'> }): HTMLElement[] {
    const key0 = key === 'leaf-facts' ? chosen({ selectionState, model }) : null, facts = key0 ? doorFacts(drawingInputOf(model.scene), model.scene.activeWardrobe, key0) : null;
    if (!facts) return [];
    const box = document.createElement('div');
    box.innerHTML = doorFactsHtml(facts);
    return [box.firstElementChild as HTMLElement];
}

/**
 * What the chosen leaf's tools show now (the toolbar's `state`): the side it hangs on ("Hinged left"), how many doors its
 * opening has ("2 doors"), and that count checked in the Doors menu. Nothing when no leaf is chosen.
 */
export function leafToolState(ports: Pick<LeafActionPorts, 'selectionState' | 'model'> & { readonly widths: () => readonly number[] }) {
    const leaf = () => {
        const key = chosen(ports);
        return key ? cabinetDoorLeaves(ports.model.activeCabinet().state, ports.widths()).find(l => leafKey(l.bay, l.row, l.leaf) === key) : undefined;
    };
    return {
        label(key: string | undefined) {
            if (key !== 'leaf-hinge' && key !== 'leaf-leaves') return undefined;
            const l = leaf();
            return !l ? undefined : key === 'leaf-hinge' ? (l.hinge === 'left' ? 'Hinged left' : 'Hinged right') : l.of === 1 ? '1 door' : l.of + ' doors';
        },
        checked(key: string) {
            if (!key.startsWith('leaves-')) return undefined;
            return leaf()?.of === Number(key.slice('leaves-'.length));
        },
    };
}
