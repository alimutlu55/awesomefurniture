import * as THREE from 'three';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { openingNoun, type OpeningKind } from '../../domain/studio/wall-utilities';
import { createStudioEditor } from './studio-editor';
import { createStudioFields } from './studio-fields';
import { createStudioResizePanel } from './studio-resize-panel';
import { createStudioPaintPanel } from './studio-paint-panel';
import { createSurfaceShapeEditor } from './surface-shape-editor';
import { addCeiling } from '../../domain/studio/studio-ceiling';
import { surfaceProfile } from '../../domain/studio/surface-profile';
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
        viewMode?: 'studio' | 'furniture'; pendingStudioAction?: string | null;
    };
    /** Late-bound editor parts: called only after the editor is mounted. */
    readonly late: {
        rendering(): { redrawStudio(): void; studioPickables(): THREE.Object3D[]; build(): void };
        inspector(): { update(keep?: boolean): void; clearFocus(): void; histUI(): void };
        report(message: string): void;
        /** The wall the view looks at, and where along it, for something added with nothing selected. */
        viewed(): { placementWall?: string; placementAlong?: number };
        camera(): {
            camRelease(): void;
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
    let paintPanel: ReturnType<typeof createStudioPaintPanel> | null = null;
    const refresh = () => { late.inspector().update(true); fields?.render(); paintPanel?.render(); shape.render(); };
    /** The Shape editor: the selected wall or ceiling shape face on, in the room panel. */
    const shape = createSurfaceShapeEditor({ document: dom.document as Document, model, sceneCommands, history, listen, callbacks: {
        redraw: () => late.rendering().redrawStudio(),
        rebuild: () => { late.rendering().build(); late.rendering().redrawStudio(); },
        refresh: () => { refresh(); late.inspector().histUI(); },
        report: m => late.report(m),
        history: step => dom.$(step === 'undo' ? '#undo2' : '#redo2').click(),
    } });
    const editor = createStudioEditor({
        model, sceneCommands, history, selectionState,
        picking: { groundPoint: (e, h) => picking.groundPoint(e, h), screenPoint: p => picking.screenPoint(new THREE.Vector3(p.x, p.y, p.z)) },
        callbacks: {
            // Selecting a room part leaves the wardrobe that was selected.
            selectionChanged: () => {
                late.camera().camRelease();
                if (selectionState.viewMode) selectionState.viewMode = 'studio';
                if (selectionState.focusOn) late.inspector().clearFocus(); else late.inspector().update(true);
                fields?.render();
                paintPanel?.render();
                // The Shape editor stays open from one wall or shape to the next, and closes with anything else.
                if (resizePanel?.showing('surface-shape')) { if (shapeTarget()) openShape(false); else shape.close(); }
                frameSelection();
            },
            redraw: () => { late.rendering().redrawStudio(); fields?.render(); if (shape.active() && !shape.dragging()) shape.render(); },
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
        const input = fields?.root.querySelector<HTMLInputElement>('[data-room-field="' + field + '"]') ?? shape.root.querySelector<HTMLInputElement>('[data-shape-field="' + field + '"]');
        input?.focus({ preventScroll: true });
        input?.select();
    }
    fields = createStudioFields({
        document: dom.document as Document, getStudio: () => model.scene.studio, getSelection: editor.selection,
        editStudio: edit => sceneCommands.editStudio(edit), refresh: () => late.inspector().update(true), listen,
        resize: { model, history, preview: edit => sceneCommands.editStudio(edit, false, true), commit: () => sceneCommands.followCeilings(true),
            active: () => dom.$('#left').dataset.roomResize !== undefined },
        rendered: () => resizePanel?.sync(),
    });
    paintPanel = createStudioPaintPanel({ document: dom.document as Document, getStudio: () => model.scene.studio,
        getSelection: editor.selection, editStudio: edit => sceneCommands.editStudio(edit), refresh, listen });
    resizePanel = createStudioResizePanel({ dom, fields, selection: editor.selection, paint: paintPanel, shape,
        prepare: () => { dom.$('#px').click(); late.camera().camRelease(); }, frame: () => late.camera().frameScene() });

    /** Escape leaves the room part; Delete removes it. Other keys are not meant for the wardrobes then. */
    listen(dom.window, 'keydown', e => {
        // The editor lives in a shadow root, which hides its elements from window listeners: ask the root what has focus.
        const root = dom.$('#app').getRootNode() as Document | ShadowRoot, k = e as KeyboardEvent;
        const target = (root.activeElement ?? k.target) as HTMLElement | null;
        if (dom.$('#app').dataset.scrubbing !== undefined || target?.closest?.('[data-measurement-badge]')) return;
        if (k.key === 'Escape' && selectionState.pendingStudioAction && !target?.closest?.('.contextual-popover')) {
            selectionState.pendingStudioAction = null;
            k.preventDefault();
            k.stopImmediatePropagation();
            return;
        }
        if (!editor.selection() || k.metaKey || k.ctrlKey || k.altKey) return;
        // Typing, and keys inside the toolbar's popover (Escape closes it first), are not for the room.
        if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.closest?.('.contextual-popover,.surface-shape'))) return;
        if (k.key === 'Escape') editor.select(null);
        else if (k.key === 'Delete' || k.key === 'Backspace') editor.act('remove');
        else if (!k.key.startsWith('Arrow')) return;
        k.preventDefault();
        k.stopImmediatePropagation();
    }, true);

    /** Wall and ceiling selection preserves the view. Openings may need a wall-facing view for editing. */
    function frameSelection() {
        const room = model.scene.studio, s = editor.selection();
        if (!room || !s) return;
        if (s.kind === 'wall' || s.kind === 'ceiling') return;
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

    /** The selected wall or ceiling shape, as the Shape editor names it. */
    function shapeTarget() {
        const s = editor.selection();
        return s?.kind === 'wall' || s?.kind === 'ceiling' ? { kind: s.kind, id: s.id } : null;
    }
    /** Opens the Shape editor on the selection and turns the view to face it: the wall face on, or a roof that
     * slopes down to the wall from the side. `turn` false keeps the view (moving from one shape to the next). */
    function openShape(turn = true) {
        const target = shapeTarget(), room = model.scene.studio;
        if (!target || !room) return;
        shape.open(target);
        resizePanel!.openShape(target.kind === 'wall' ? 'Wall shape' : 'Shape', turn);
        const s = surfaceProfile(room, target), line = s && wallLine(room, s.wall), face = s && wallFace(room, s.wall);
        if (!turn || !s || !line || !face) return;
        const mid = (face.start + face.end) / 2, reach = s.view === 'side' ? s.context.to : Math.max(60, s.depth), off = s.wall.thickness / 2 + reach / 2;
        const at = { x: line.a.x + line.ux * mid + line.nx * off, z: line.a.z + line.uz * mid + line.nz * off };
        if (s.view === 'front') late.camera().frameBox({ ...at, w: Math.max(150, face.length), d: reach, h: s.context.top }, Math.atan2(line.nx, line.nz), .16, 1.12);
        else late.camera().frameBox({ ...at, w: Math.max(150, reach), d: face.length, h: s.context.top }, Math.atan2(-line.ux, -line.uz), .16, 1.12);
    }
    /** A shape on a wall: the selected one (or the selected shape's or opening's wall), else the wall in view,
     * centred where the view looks. It is selected and opened in the Shape editor. */
    function addShape(shapeId: string) {
        const room = model.scene.studio, s = editor.selection(), view = late.viewed();
        if (!room?.walls.length) { late.report('Add walls first, then a shape on one of them.'); return; }
        const own = s?.kind === 'wall' ? s.id : s?.kind === 'ceiling' ? room.ceilings?.find(c => c.id === s.id)?.wall
            : s?.kind === 'opening' ? room.openings.find(o => o.id === s.id)?.wall : undefined;
        const wallId = own ?? view.placementWall ?? room.walls[0]!.id, centre = wallId === view.placementWall ? view.placementAlong : undefined;
        if (!sceneCommands.editStudio(r => addCeiling(r, wallId, shapeId, centre))) { late.report('This wall is too short for that shape.'); return; }
        sceneCommands.followCeilings(true);
        editor.select({ kind: 'ceiling', id: model.scene.studio!.ceilings!.at(-1)!.id });
        refresh();
        openShape();
    }

    /** Room-level opening, utility and ceiling tools first ask for their supporting wall. */
    function actOnWall(key: string) {
        if (key.startsWith('ceiling:')) { addShape(key.slice(8)); return; }
        const label = openingNoun(key as OpeningKind);
        if (!model.scene.studio?.walls.length) {
            late.report('Add walls first, then choose a wall for this ' + label + '.');
            return;
        }
        if (editor.selection()) { editor.act(key); return; }
        selectionState.pendingStudioAction = key;
        late.report('Select a wall for the ' + label + '.');
        late.camera().frameScene();
    }

    return {
        editor, fields, frameRoom, resizePanel, actOnWall, paintPanel, shape, openShape,
        /** Dragging the selected wall, opening or ceiling by its surface on the canvas. */
        surface: {
            grab(e: PointerEvent, wardrobe: THREE.Intersection | undefined) {
                const sel = editor.selection();
                if (!sel) return false;
                const hit = picking.cast(e, late.rendering().studioPickables());
                const ghosted = sel.kind === 'wall' || sel.kind === 'opening';
                if (!hit || (!ghosted && wardrobe && wardrobe.distance < hit.distance)) return false;
                return editor.grab(e, hit as never, e.target as HTMLElement);
            },
            move: (e: PointerEvent) => editor.move(e), end: (cancel?: boolean) => editor.end(cancel), dragging: () => editor.dragging(),
        },
        /** For picking: the room's walls and openings, and what a hit selects. */
        room: { pickables: () => late.rendering().studioPickables(), pick: (hit: THREE.Intersection | undefined) => {
            const picked = editor.pick(hit);
            if (picked && editor.selection()?.kind !== 'opening') late.camera().camRelease();
            if (picked && editor.selection()?.kind === 'wall' && selectionState.pendingStudioAction) {
                const action = selectionState.pendingStudioAction;
                selectionState.pendingStudioAction = null;
                editor.act(action);
            }
            return picked;
        } },
    };
}
