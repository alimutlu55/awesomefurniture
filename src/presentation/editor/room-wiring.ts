import * as THREE from 'three';
import { wallFace, wallLine } from '../../domain/studio/studio';
import { openingNoun, type OpeningKind } from '../../domain/studio/wall-utilities';
import { createStudioEditor } from './studio-editor';
import { createFixtureEditor } from './fixture-editor';
import { createStudioFields } from './studio-fields';
import { createStudioResizePanel } from './studio-resize-panel';
import { createStudioPaintPanel } from './studio-paint-panel';
import { createFixturePanel } from './fixture-panel';
import { createSurfaceShapeEditor } from './surface-shape-editor';
import { addCeiling } from '../../domain/studio/studio-ceiling';
import { surfaceProfile } from '../../domain/studio/surface-profile';
import { fixturePlace } from '../../domain/studio/fixtures/fixture-place';
import type { StudioEditorPorts } from './studio-editor.ports';

type Listenable = { addEventListener(event: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void };
interface RoomWiringPorts {
    readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
    readonly model: StudioEditorPorts['model'];
    readonly sceneCommands: StudioEditorPorts['sceneCommands'] & import('./fixture-editor').FixtureEditorPorts['sceneCommands']
        & Parameters<typeof createFixturePanel>[0]['sceneCommands']
        & Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'resizeWallLength'>;
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
    let fixturePanel: ReturnType<typeof createFixturePanel> | null = null;
    const refresh = () => { late.inspector().update(true); fields?.render(); paintPanel?.render(); fixturePanel?.render(); shape.render(); };
    /** The Shape editor: the selected wall or ceiling shape face on, in the room panel. */
    const shape = createSurfaceShapeEditor({ document: dom.document as Document, model, sceneCommands, history, listen, callbacks: {
        redraw: () => late.rendering().redrawStudio(),
        rebuild: () => { late.rendering().build(); late.rendering().redrawStudio(); },
        refresh: () => { refresh(); late.inspector().histUI(); },
        report: m => late.report(m),
        history: step => dom.$(step === 'undo' ? '#undo2' : '#redo2').click(),
        viewChanged: () => frameShape(),
    } });
    const room = createStudioEditor({
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
                // A fixture's Type or Finish stays open from one fixture to the next, and closes with anything else.
                if (resizePanel?.showing('fixture') && room.selection()?.kind !== 'fixture') resizePanel.close();
                fixturePanel?.render();
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
    const fixtures = createFixtureEditor({ model, sceneCommands, history, selection: room.selection,
        picking: { screenPoint: p => picking.screenPoint(new THREE.Vector3(p.x, p.y, p.z)) },
        callbacks: { select: next => room.select(next), redraw: () => { late.rendering().redrawStudio(); fields?.render(); }, refresh, histUI: () => late.inspector().histUI() } });
    const onFixture = () => room.selection()?.kind === 'fixture';
    /** The room editor and the fixture editor as one: a selected fixture's measures, guides, drags and commands are its own. */
    const editor: typeof room = { ...room,
        measures: () => onFixture() || fixtures.dragging() ? fixtures.measures() : room.measures(),
        guides: () => fixtures.dragging() ? fixtures.guides() : room.guides(),
        reason: () => fixtures.reason() ?? room.reason(),
        dragging: () => fixtures.dragging() || room.dragging(),
        dragKey: () => fixtures.dragKey() ?? room.dragKey(),
        move: e => fixtures.dragging() ? fixtures.move(e) : room.move(e),
        end: cancel => fixtures.dragging() ? fixtures.end(cancel) : room.end(cancel),
        act: key => { if (!fixtures.act(key)) room.act(key); },
        editMeasure: m => { if (onFixture()) { if (m.edit) openFields('fixture-size', m.edit); } else room.editMeasure(m); },
    };
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
        resizeWallLength: (id, length, preview) => sceneCommands.resizeWallLength(id, length, !preview, preview),
        resize: { model, history, preview: edit => sceneCommands.editStudio(edit, false, true), commit: () => sceneCommands.followCeilings(true),
            active: () => dom.$('#left').dataset.roomResize !== undefined },
        rendered: () => resizePanel?.sync(),
    });
    paintPanel = createStudioPaintPanel({ document: dom.document as Document, getStudio: () => model.scene.studio,
        getSelection: editor.selection, editStudio: edit => sceneCommands.editStudio(edit), refresh, listen });
    fixturePanel = createFixturePanel({ document: dom.document as Document, getStudio: () => model.scene.studio, getSelection: editor.selection,
        sceneCommands, refresh: () => { refresh(); late.rendering().redrawStudio(); }, listen });
    resizePanel = createStudioResizePanel({ dom, fields, selection: editor.selection, paint: paintPanel, shape, fixture: fixturePanel,
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
        else if (onFixture() && (k.key === 'ArrowLeft' || k.key === 'ArrowRight')) fixtures.nudge((k.key === 'ArrowRight' ? 1 : -1) * (k.shiftKey ? 10 : 1));
        else if (!k.key.startsWith('Arrow')) return;
        k.preventDefault();
        k.stopImmediatePropagation();
    }, true);

    /** Wall and ceiling selection preserves the view. Openings and fixtures may need a wall-facing view for editing. */
    function frameSelection() {
        const room = model.scene.studio, s = editor.selection();
        if (!room || !s) return;
        if (s.kind === 'wall' || s.kind === 'ceiling') return;
        if (s.kind === 'fixture') { frameFixture(s.id, false); return; }
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

    /** A three-quarter view from above the room onto a fixture and the wall behind it, as you would stand to look at a
     * toilet or a basin. `always` turns to it even when it is already in good view (a fixture just added). */
    function frameFixture(id: string, always: boolean) {
        const room = model.scene.studio, f = room?.fixtures?.find(x => x.id === id), place = room && f && fixturePlace(room, f);
        if (!room || !f || !place) return;
        const c = late.camera().camNow(), line = place.line, front = place.at(f.offset, place.back + f.depth / 2);
        const cam = { x: c.x + c.dist * Math.cos(c.el) * Math.sin(c.az), z: c.z + c.dist * Math.cos(c.el) * Math.cos(c.az) };
        const facing = (cam.x - front.x) * line.nx + (cam.z - front.z) * line.nz > 0, near = Math.hypot(cam.x - front.x, cam.z - front.z) < 450;
        if (!always && facing && c.el >= .3 && near) return;
        const span = Math.max(150, f.width * 3.2), mid = place.at(f.offset, (place.back + f.depth) / 2 + 30);
        late.camera().frameBox({ x: mid.x, z: mid.z, w: span, d: span * .7, h: Math.min(place.wall.height, 190) }, Math.atan2(line.nx, line.nz) + .5, .42, 1.05);
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
        if (turn) frameShape();
    }
    /** Turns the view to face the shape from the side the editor shows: the wall face on, or along the wall. */
    function frameShape() {
        const target = shapeTarget(), room = model.scene.studio;
        if (!target || !room) return;
        const s = surfaceProfile(room, target, shape.view() ?? undefined), line = s && wallLine(room, s.wall), face = s && wallFace(room, s.wall);
        if (!s || !line || !face) return;
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

    /** A fixture on the selected part's wall, else on the wall in view, near where the view looks; it is selected. */
    function addFixture(kind: string) {
        const room = model.scene.studio, s = editor.selection(), view = late.viewed();
        if (!room?.walls.length) { late.report('Add walls first, then a toilet or a basin against one of them.'); return; }
        const own = s?.kind === 'wall' ? s.id : s?.kind === 'ceiling' ? room.ceilings?.find(c => c.id === s.id)?.wall
            : s?.kind === 'opening' ? room.openings.find(o => o.id === s.id)?.wall : s?.kind === 'fixture' ? room.fixtures?.find(f => f.id === s.id)?.wall : undefined;
        const wallId = own ?? view.placementWall, near = wallId && wallId === view.placementWall && !own ? view.placementAlong : undefined;
        const id = sceneCommands.addStudioFixture(kind, wallId, near);
        if (!id) { refresh(); return; }
        editor.select({ kind: 'fixture', id });
        refresh();
        late.rendering().redrawStudio();
        frameFixture(id, true);
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
        editor, fields, frameRoom, resizePanel, actOnWall, addFixture, paintPanel, shape, openShape,
        /** Dragging the selected wall, opening or ceiling by its surface on the canvas. */
        surface: {
            grab(e: PointerEvent, wardrobe: THREE.Intersection | undefined) {
                const sel = editor.selection();
                if (!sel) return false;
                const hit = picking.cast(e, late.rendering().studioPickables());
                const ghosted = sel.kind === 'wall' || sel.kind === 'opening';
                if (!hit || (!ghosted && wardrobe && wardrobe.distance < hit.distance)) return false;
                if (hit.object.userData.studioFixture) return fixtures.grab(e, hit as never, e.target as HTMLElement);
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
