import * as THREE from 'three';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { createStudioEditor } from './studio-editor';
import { createStudioFields } from './studio-fields';
import { createCeilingChoices } from './studio-ceiling-panel';
import { createStudioResizePanel } from './studio-resize-panel';
import type { StudioEditorPorts } from './studio-editor.ports';

type Listenable = { addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void };
interface RoomWiringPorts {
    readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
    readonly model: StudioEditorPorts['model'];
    readonly sceneCommands: StudioEditorPorts['sceneCommands'];
    readonly history: { checkpoint(snapshot: string): void };
    readonly picking: {
        groundPoint(e: PointerEvent, height?: number): THREE.Vector3 | null; screenPoint(p: THREE.Vector3): { x: number; y: number };
        cast(e: PointerEvent, objects: THREE.Object3D[]): THREE.Intersection | undefined;
    };
    readonly selectionState: StudioEditorPorts['selectionState'] & {
        viewMode?: 'studio' | 'wardrobe'; pendingStudioAction?: string | null;
    };
    /** Late-bound editor parts: called only after the editor is mounted. */
    readonly late: {
        rendering(): { redrawStudio(): void; studioPickables(): THREE.Object3D[]; build(): void };
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
    let resizePanel: ReturnType<typeof createStudioResizePanel> | null = null;
    const refresh = () => { late.inspector().update(true); fields?.render(); };
    const editor = createStudioEditor({
        model, sceneCommands, history, selectionState,
        picking: { groundPoint: (e, h) => picking.groundPoint(e, h), screenPoint: p => picking.screenPoint(new THREE.Vector3(p.x, p.y, p.z)) },
        callbacks: {
            // Selecting a room part leaves the wardrobe that was selected.
            selectionChanged: () => {
                if (selectionState.viewMode) selectionState.viewMode = 'studio';
                if (selectionState.focusOn) late.inspector().clearFocus(); else late.inspector().update(true);
                fields?.render();
                frameSelection();
            },
            redraw: () => { late.rendering().redrawStudio(); fields?.render(); },
            rebuild: () => { late.rendering().build(); late.rendering().redrawStudio(); fields?.render(); },
            openFields,
            refresh, histUI: () => late.inspector().histUI(), report: m => late.report(m),
        },
    });
    /** Tap to type: opens the toolbar's fields for the selection and puts one in focus. */
    function openFields(action: string, field: string) {
        const toolbar = dom.$('#toolbar'), selector = '[data-action="' + action + '"]';
        const button = toolbar.querySelector<HTMLButtonElement>(selector);
        if (button && button.getAttribute('aria-expanded') !== 'true') button.click();
        // Kept in More: open More, then the fields from it.
        if (!button) {
            toolbar.querySelector<HTMLButtonElement>('[data-action="more"]')?.click();
            (toolbar.getRootNode() as ParentNode).querySelector<HTMLButtonElement>('.contextual-popover ' + selector)?.click();
        }
        const input = fields?.root.querySelector<HTMLInputElement>('[data-room-field="' + field + '"]');
        input?.focus({ preventScroll: true });
        input?.select();
    }
    const ceilingChoices = createCeilingChoices({ document: dom.document as Document, listen, choose: key => {
        dom.$('#toolbar').querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.click();
        actOnWall(key);
    } });
    fields = createStudioFields({
        document: dom.document as Document, getStudio: () => model.scene.studio, getSelection: editor.selection,
        editStudio: edit => sceneCommands.editStudio(edit), refresh: () => late.inspector().update(true), listen,
        resize: { model, history, preview: edit => sceneCommands.editStudio(edit, false, true), commit: () => sceneCommands.followCeilings(true),
            active: () => dom.$('#left').dataset.roomResize !== undefined },
        rendered: () => resizePanel?.sync(),
    });
    resizePanel = createStudioResizePanel({ dom, fields, selection: editor.selection,
        prepare: () => dom.$('#px').click(), frame: () => late.camera().frameScene() });

    /** Escape leaves the room part; Delete removes it. Other keys are not meant for the wardrobes then. */
    listen(dom.window, 'keydown', e => {
        const k = e as KeyboardEvent, target = k.target as HTMLElement | null;
        if (k.key === 'Escape' && selectionState.pendingStudioAction && !target?.closest?.('.contextual-popover')) {
            selectionState.pendingStudioAction = null;
            k.preventDefault();
            k.stopImmediatePropagation();
            return;
        }
        if (!editor.selection() || k.metaKey || k.ctrlKey || k.altKey) return;
        // Typing, and keys inside the toolbar's popover (Escape closes it first), are not for the room.
        if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.closest?.('.contextual-popover'))) return;
        if (k.key === 'Escape') editor.select(null);
        else if (k.key === 'Delete' || k.key === 'Backspace') editor.act('remove');
        else if (!k.key.startsWith('Arrow')) return;
        k.preventDefault();
        k.stopImmediatePropagation();
    }, true);

    /** Room editing keeps the whole studio visible from the wardrobe's front, slightly above the floor.
     * Looking straight at a selected wall can put the wardrobe's back in front of every room control. */
    function frameSelection() {
        const room = model.scene.studio, s = editor.selection();
        if (!room || !s) return;
        if (s.kind === 'wall' || s.kind === 'ceiling') { late.camera().frameScene(); return; }
        // An opening keeps its own wall-facing view for adjusting its position and exact size.
        const id = room.openings.find(o => o.id === s.id)?.wall, w = room.walls.find(x => x.id === id);
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

    /** Room-level opening and ceiling tools first ask for their supporting wall. */
    function actOnWall(key: string) {
        if (!model.scene.studio?.walls.length) {
            late.report('Add walls first, then choose a wall for this ' + (key.startsWith('ceiling:') ? 'ceiling.' : 'opening.'));
            return;
        }
        if (editor.selection()) { editor.act(key); return; }
        selectionState.pendingStudioAction = key;
        late.report('Select a wall for the ' + (key.startsWith('ceiling:') ? 'ceiling' : key) + '.');
        late.camera().frameScene();
    }

    return {
        editor, fields, frameRoom, ceilingChoices, resizePanel, actOnWall,
        /** Dragging the selected wall, opening or ceiling by its surface on the canvas. */
        surface: {
            grab(e: PointerEvent, wardrobe: THREE.Intersection | undefined) {
                if (!editor.selection()) return false;
                const hit = picking.cast(e, late.rendering().studioPickables());
                if (!hit || (wardrobe && wardrobe.distance < hit.distance)) return false;
                return editor.grab(e, hit as never, e.target as HTMLElement);
            },
            move: (e: PointerEvent) => editor.move(e), end: (cancel?: boolean) => editor.end(cancel), dragging: () => editor.dragging(),
        },
        /** For picking: the room's walls and openings, and what a hit selects. */
        room: { pickables: () => late.rendering().studioPickables(), pick: (hit: THREE.Intersection | undefined) => {
            const selected = editor.selection(), data = hit?.object.userData;
            const repeat = selected?.kind === 'ceiling' ? data?.studioCeiling === selected.id : selected?.kind === 'wall' && data?.studioWall === selected.id;
            const picked = editor.pick(hit);
            if (picked && editor.selection()?.kind === 'wall' && selectionState.pendingStudioAction) {
                const action = selectionState.pendingStudioAction;
                selectionState.pendingStudioAction = null;
                editor.act(action);
            }
            // A tap after orbiting or zooming restores context; dragging leaves the camera stationary.
            if (picked && repeat) frameSelection();
            return picked;
        } },
    };
}
