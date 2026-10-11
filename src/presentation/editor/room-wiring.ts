import * as THREE from 'three';
import { studioBounds } from '../../domain/studio/studio';
import { createStudioEditor } from './studio-editor';
import { createStudioFields } from './studio-fields';
import type { StudioEditorPorts } from './studio-editor.ports';

type Listenable = { addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void };
interface RoomWiringPorts {
    readonly dom: { document: unknown; window: Listenable };
    readonly model: StudioEditorPorts['model'];
    readonly sceneCommands: StudioEditorPorts['sceneCommands'];
    readonly history: { checkpoint(snapshot: string): void };
    readonly picking: { groundPoint(e: PointerEvent, height?: number): THREE.Vector3 | null; screenPoint(p: THREE.Vector3): { x: number; y: number } };
    readonly selectionState: StudioEditorPorts['selectionState'] & { focusOn: boolean };
    /** Late-bound editor parts: called only after the editor is mounted. */
    readonly late: {
        rendering(): { redrawStudio(): void; studioPickables(): THREE.Object3D[] };
        inspector(): { update(keep?: boolean): void; clearFocus(): void; histUI(): void };
        report(message: string): void;
        camera(): { frameBox(bounds: { x: number; z: number; w: number; d: number; h: number }, az: number, el: number, padding: number): void };
        wardrobeBounds(): { x: number; z: number; w: number; d: number; h: number };
    };
    readonly listen: (target: Listenable, type: string, handler: (e: Event) => void, options?: boolean | AddEventListenerOptions) => void;
}

/** The room editor, its Size fields and its keys, connected to the rest of the editor. */
export function createRoomWiring({ dom, model, sceneCommands, history, picking, selectionState, late, listen }: RoomWiringPorts) {
    let fields: ReturnType<typeof createStudioFields> | null = null;
    const refresh = () => { late.inspector().update(true); fields?.render(); };
    const editor = createStudioEditor({
        model, sceneCommands, history, selectionState,
        picking: { groundPoint: (e, h) => picking.groundPoint(e, h), screenPoint: p => picking.screenPoint(new THREE.Vector3(p.x, p.y, p.z)) },
        callbacks: {
            // Selecting a room part leaves the wardrobe that was selected.
            selectionChanged: () => { if (selectionState.focusOn) late.inspector().clearFocus(); else late.inspector().update(true); fields?.render(); },
            redraw: () => { late.rendering().redrawStudio(); fields?.render(); },
            refresh, histUI: () => late.inspector().histUI(), report: m => late.report(m),
        },
    });
    fields = createStudioFields({
        document: dom.document as Document, getStudio: () => model.scene.studio, getSelection: editor.selection,
        editStudio: edit => sceneCommands.editStudio(edit), refresh: () => late.inspector().update(true), listen,
    });

    /** Escape leaves the room part; Delete removes it. Other keys are not meant for the wardrobes then. */
    listen(dom.window, 'keydown', e => {
        const k = e as KeyboardEvent, target = k.target as HTMLElement | null;
        if (!editor.selection() || k.metaKey || k.ctrlKey || k.altKey) return;
        // Typing, and keys inside the toolbar's popover (Escape closes it first), are not for the room.
        if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.closest?.('.contextual-popover'))) return;
        if (k.key === 'Escape') editor.select(null);
        else if (k.key === 'Delete' || k.key === 'Backspace') editor.act('remove');
        else if (!k.key.startsWith('Arrow')) return;
        k.preventDefault();
        k.stopImmediatePropagation();
    }, true);

    /** Flies to a view of the whole room (and any wardrobe outside it), from above the lowered walls. */
    function frameRoom() {
        const room = model.scene.studio && studioBounds(model.scene.studio), w = late.wardrobeBounds();
        if (!room) return;
        const x0 = Math.min(room.x0, w.x - w.w / 2), x1 = Math.max(room.x1, w.x + w.w / 2), z0 = Math.min(room.z0, w.z - w.d / 2), z1 = Math.max(room.z1, w.z + w.d / 2);
        late.camera().frameBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: Math.min(room.height, w.h + 40) }, .6, .62, 1.04);
    }

    return {
        editor, fields, frameRoom,
        /** For picking: the room's walls and openings, and what a hit selects. */
        room: { pickables: () => late.rendering().studioPickables(), pick: (hit: THREE.Intersection | undefined) => editor.pick(hit) },
    };
}
