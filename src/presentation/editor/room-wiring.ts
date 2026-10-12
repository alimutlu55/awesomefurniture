import * as THREE from 'three';
import { wallFace, wallLine } from '../../domain/studio/studio';
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
        camera(): {
            frameScene(): void;
            frameBox(bounds: { x: number; z: number; w: number; d: number; h: number }, az: number, el: number, padding: number): void;
            camNow(): { az: number; el: number; dist: number; x: number; y: number; z: number };
        };
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
            selectionChanged: () => {
                if (selectionState.focusOn) late.inspector().clearFocus(); else late.inspector().update(true);
                fields?.render();
                faceSelection();
            },
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
        // Focused room grips handle their own arrow keys at the target.
        if (k.key.startsWith('Arrow') && target?.closest?.('.room-handle')) return;
        if (k.key === 'Escape') editor.select(null);
        else if (k.key === 'Delete' || k.key === 'Backspace') editor.act('remove');
        else if (!k.key.startsWith('Arrow')) return;
        k.preventDefault();
        k.stopImmediatePropagation();
    }, true);

    /** A wall (or an opening on one) selected from behind, where it is lowered, or from eye level, is brought
     * round to an editing view: a three-quarter view of its face from above, where its corners and grips can
     * be dragged. A wall already facing the camera from above keeps the view, so selecting never jumps
     * needlessly. */
    function faceSelection() {
        const room = model.scene.studio, s = editor.selection();
        if (!room || !s) return;
        const id = s.kind === 'wall' ? s.id : room.openings.find(o => o.id === s.id)?.wall, w = room.walls.find(x => x.id === id);
        const line = w && wallLine(room, w), face = w && wallFace(room, w);
        if (!w || !line || !face) return;
        const c = late.camera().camNow(), cam = { x: c.x + c.dist * Math.cos(c.el) * Math.sin(c.az), z: c.z + c.dist * Math.cos(c.el) * Math.cos(c.az) };
        const mid = { x: (face.from.x + face.to.x) / 2, z: (face.from.z + face.to.z) / 2 };
        // Seen from the room and from high enough to drag its grips: keep the view. From behind, or from eye
        // level (where moving the wall would point straight at the camera), turn to a three-quarter view above.
        if ((cam.x - mid.x) * line.nx + (cam.z - mid.z) * line.nz > 0 && c.el >= .35) return;
        const span = Math.max(150, face.length);
        late.camera().frameBox({ x: mid.x + line.nx * 60, z: mid.z + line.nz * 60, w: span, d: span * .5, h: w.height }, Math.atan2(line.nx, line.nz) + .62, .55, 1.08);
    }

    /** Flies to show the whole room: every wall, the floor and the wardrobes (`frameScene`). */
    function frameRoom() {
        if (model.scene.studio) late.camera().frameScene();
    }

    return {
        editor, fields, frameRoom,
        /** For picking: the room's walls and openings, and what a hit selects. */
        room: { pickables: () => late.rendering().studioPickables(), pick: (hit: THREE.Intersection | undefined) => editor.pick(hit) },
    };
}
