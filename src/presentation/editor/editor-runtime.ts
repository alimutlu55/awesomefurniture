import { createClothingWarmup } from '../viewport/clothing-warmup';
import { createStudioPanel } from './studio-panel';
import { createRoomWiring } from './room-wiring';
import { createKitchenPanel } from './kitchen-panel';
import { createFurnitureFraming } from './furniture-framing';
import { viewedPlacement } from './viewed-placement';
import { createKitchenArrayGesture } from './kitchen-array-gesture';
import { bindLengthUnits } from './length-units-menu';
import { bindMaxReachMenu } from './max-reach-menu';
import { bindDrawingsViewer } from '../drawings/drawings-viewer';
import { createTactileFeedback } from './tactile-feedback';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { ProjectDocument } from '../../domain/project/project';
import type { createEditorDom } from './editor-dom';
import { createModulePort } from './module-port';
import { createScenePicking } from './scene-picking.js';
import { createThreeViewport } from '../viewport/three-viewport';
import { applyViewportSession } from '../viewport/project-view';
import { projectToScene } from '../../application/projects/editor-mapper';
import { createViewportResources } from '../viewport/viewport-resources.js';
import { capturePreview } from '../viewport/capture-preview';
import { captureDesignReferences } from '../viewport/capture-design-references';
import { imageDesignSpecification } from '../../application/projects/image-design-specification';
import { bindDesignImageViewer } from '../ai/design-image-viewer';
import { DesignImageUserError } from '../ai/design-image-errors';
import { createEditorLifetime } from '../viewport/editor-lifetime.js';
import { createEditorModel } from '../../application/projects/editor-model.js';
import { createSceneHistory } from '../../application/history/scene-history.js';
import { createDesignCommands } from '../../application/commands/design-commands.js';
import { createSceneCommands } from '../../application/commands/scene-commands.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createPlannerService } from '../../application/projects/planner-service.js';
import { getEditorElements } from './editor-dom.js';
import { mountEditorBindings } from './mount-editor-bindings.js';
import { bindShareMenu } from './bindings/share.js';
import { createCameraController } from '../viewport/camera-controller.js';
import { createCabinetRenderer } from '../viewport/cabinet-renderer.js';
import { createEditorGestures } from './editor-gestures.js';
import { createInspectorPresenter } from './inspector-presenter.js';
import { createPlannerPresenter } from './planner-presenter.js';
import { createEditorShell } from './editor-shell.js';
import { createCameraState } from '../viewport/camera-state.js';
import { createInteractionState } from './interaction-state.js';
import { createRenderState } from '../viewport/render-state.js';
import { createSelectionState } from './selection-state.js';
import { createPlannerState } from './planner-state.js';
import { createShellState } from './shell-state.js';
import { createShapeInspector } from './shape-inspector';
/** Composition root: construct services, connect explicit ports, then mount the UI. */
export function startEditor(initialScene: EditorScene | undefined, dom: ReturnType<typeof createEditorDom>, shareLink?: (scene: EditorScene) => Promise<string>) {
    const { $ } = dom;
    const lifetime = createEditorLifetime();
    lifetime.cleanup(() => dom.dispose());
    const model = createEditorModel(initialScene);
    const settings = { budget: 900 };
    const elements = getEditorElements(dom);
    const cameraState = createCameraState({ reducedMotion: dom.matchMedia('(prefers-reduced-motion: reduce)') });
    const interactionState = createInteractionState();
    const renderState = createRenderState();
    const selectionState = createSelectionState();
    elements.app.classList.add('props-hidden');
    const plannerState = createPlannerState();
    const shellState = createShellState();
    try {
        const resources = createViewportResources($('#c'));
        lifetime.cleanup(() => resources.dispose());
        const history = createSceneHistory(model.snapshot, model.restore);
        const geometry = createWardrobeGeometry(() => model.activeCabinet().state, () => settings.budget);
        const cabinetGeometry = createCabinetGeometry(() => model.scene.wardrobes, () => studioObstacles(model.scene.studio));
        const plannerService = createPlannerService();
        // Each explicit controller port is connected exactly once before events can run.
        const picking = createScenePicking({ dom, interactionState, renderState, resources, model });
        /** @type {import('./module-port').ModulePort<ReturnType<typeof createCameraController>>} */
        const cameraPort = createModulePort<ReturnType<typeof createCameraController>>();
        const camera = cameraPort.api;
        /** @type {import('./module-port').ModulePort<ReturnType<typeof createCabinetRenderer>>} */
        const renderingPort = createModulePort<ReturnType<typeof createCabinetRenderer>>();
        const rendering = renderingPort.api;
        /** @type {import('./module-port').ModulePort<ReturnType<typeof createEditorGestures>>} */
        const interactionsPort = createModulePort<ReturnType<typeof createEditorGestures>>();
        const interactions = interactionsPort.api;
        /** @type {import('./module-port').ModulePort<ReturnType<typeof createInspectorPresenter>>} */
        const inspectorPort = createModulePort<ReturnType<typeof createInspectorPresenter>>();
        const inspector = inspectorPort.api;
        /** @type {import('./module-port').ModulePort<ReturnType<typeof createPlannerPresenter>>} */
        const plannerPort = createModulePort<ReturnType<typeof createPlannerPresenter>>();
        const planner = plannerPort.api;
        /** @type {import('./module-port').ModulePort<ReturnType<typeof createEditorShell>>} */
        const shellPort = createModulePort<ReturnType<typeof createEditorShell>>();
        const shell = shellPort.api;
        const historyActions = { checkpoint() {
                if (interactionState.wardrobeGesture) {
                    interactions.finishWardrobeDrag();
                }
                if (interactionState.rotationGesture) {
                    interactions.finishRotation();
                }
                history.checkpoint(model.snapshot());
                inspector.histUI();
            } };
        const sceneCommands = createSceneCommands(() => model.scene, { checkpoint: historyActions.checkpoint, discardCheckpoint: history.discardCheckpoint, report: message => shell.toast(message) });
        const commands = createDesignCommands(() => model.activeCabinet().state, {
            getBudget: () => settings.budget, report: (message, action) => shell.toast(message, action), changed: keep => inspector.update(keep),
            checkpoint: historyActions.checkpoint, discardCheckpoint: history.discardCheckpoint,
            closeInspector: () => inspector.hidePop(), milestone: key => shellState.G[key] = 1,
            selectionChanged: value => {
                if (value.deep !== undefined) {
                    selectionState.deep = value.deep;
                }
                if (value.pillOn !== undefined) {
                    selectionState.pillOn = value.pillOn;
                }
            }, requestUndo: () => inspector.undo()
        });
        const viewport = createThreeViewport({
            renderModel: (project, session) => {
                const next = projectToScene(project) ?? createEditorModel().scene;
                const flags = applyViewportSession(project, next, session);
                model.restore(JSON.stringify(next));
                history.clear();
                Object.assign(selectionState, flags);
                selectionState.viewMode = 'furniture';
                selectionState.room = null;
                selectionState.pendingStudioAction = null;
                inspector.hidePop();
                inspector.update(true);
                if (flags.focusOn) camera.frameWardrobe(); else camera.frameScene();
                if (session.openPanel === 'planner') {
                    planner.openWizard();
                }
                else if (session.openPanel === 'properties') {
                    inspector.showPop(null, model.activeCabinet().state.divider >= 0 ? '#pop4' : model.activeCabinet().state.item >= 0 ? '#pop3' : '#pop2');
                }
            },
            resizeSurface: (width, height) => {
                resources.R.setSize(width, height);
                camera.applyView({ width, height });
                // Resizing clears the WebGL drawing buffer. Repaint before the browser
                // composites the animated sheet resize, rather than leaving a blank frame.
                resources.R.render(resources.scene, resources.cam);
            },
            disposeResources: () => lifetime.dispose()
        });
        // The room: selecting and editing walls and openings, and choosing a built-in studio (framed whole).
        const room = createRoomWiring({ dom, model, sceneCommands, history, picking, selectionState, listen: lifetime.listen, late: {
            rendering: () => rendering, inspector: () => inspector, report: message => shell.toast(message), camera: () => camera } });
        const studioPanel = createStudioPanel({ dom, model, sceneCommands, getSelection: room.editor.selection, callbacks: {
            chooseCeiling: shape => { inspector.hidePop(); room.actOnWall('ceiling:' + shape); },
            placed: () => { selectionState.viewMode = 'studio'; selectionState.room = null; inspector.clearFocus(); room.frameRoom(); },
            // A part just added is selected; a ceiling also turns the view to eye level to shape it.
            added: selection => { inspector.hidePop(); inspector.clearFocus(); room.editor.select(selection); }, refresh: () => inspector.update(true) } });
        const framing = createFurnitureFraming({ model, camera });
        // Kitchen cabinets: a new unit is selected and framed with its run, ready for Add item and the pull-out gesture.
        const kitchenPanel = createKitchenPanel({ dom, add: preset => {
            // From a selected cabinet's Add it joins that cabinet; from Add furniture it goes on the wall in view.
            const beside = dom.$('#pop2').dataset.addContext === 'kitchen';
            const unit = sceneCommands.addKitchenUnit(preset, { ...viewedPlacement(model.scene.studio, resources.cam), beside });
            if (!unit) return false;
            Object.assign(selectionState, { room: null, pillOn: true, deep: true, shapeEditing: false });
            inspector.hidePop();
            inspector.update();
            framing.frame();
            shell.toast(unit.name + ' added');
            return true;
        } });
        // Pull-to-array: copies of a kitchen unit pulled out from its side or after a long press.
        const arrayFeedback = createTactileFeedback(dom);
        const kitchenArray = createKitchenArrayGesture({ dom, model, sceneCommands, history: { checkpoint: snapshot => history.checkpoint(snapshot) }, lifetime, picking, renderState,
            callbacks: { rebuild: () => rendering.build(), finished: () => { inspector.update(true); inspector.histUI(); }, added: () => framing.frame(), toast: message => shell.toast(message), tick: count => arrayFeedback.tick(count) } });
        lifetime.cleanup(() => kitchenArray.dispose());
        const shapeInspector = createShapeInspector({ dom, model, sceneCommands, picking, selectionState, callbacks: {
            refresh: () => inspector.update(true), rebuild: () => rendering.build(), histUI: () => inspector.histUI(),
            frame: () => camera.frameMobileInspector(true), report: message => shell.toast(message) } });
        cameraPort.connect(createCameraController({ dom, inspector, picking, cameraState, interactionState, renderState, geometry, cabinetGeometry, resources, model, viewport }));
        renderingPort.connect(createCabinetRenderer({ dom, camera, interactions, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, resources, model, commands, settings, lifetime, shapeInspector, studioEditor: room.editor, kitchenArray }));
        interactionsPort.connect(createEditorGestures({ dom, camera, rendering, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, geometry, cabinetGeometry, resources, model, commands, sceneCommands, history, room: room.room }));
        inspectorPort.connect(createInspectorPresenter({ dom, elements, camera, rendering, interactions, planner, shell, cameraState, interactionState,
            renderState, selectionState, shellState, geometry, resources, model, commands, sceneCommands, history, shapeInspector, studioPanel, kitchenPanel, roomFields: room.fields }));
        plannerPort.connect(createPlannerPresenter({ dom, inspector, shell, plannerState, geometry, model, commands, plannerService, lifetime }));
        shellPort.connect(createEditorShell({ dom, shellState, geometry, model, lifetime, elements }));
        mountEditorBindings({ dom, picking, camera, rendering, interactions, inspector, planner, shell, cameraState, interactionState, renderState, selectionState, plannerState, shellState, geometry, resources, model, commands, sceneCommands, history, lifetime, elements, room, kitchenArray });
        bindShareMenu({ dom, shell, model, lifetime, shareLink });
        bindLengthUnits({ dom, lifetime, redraw: () => { rendering.build(); inspector.update(true); rendering.redrawStudio(); } });
        bindMaxReachMenu({ dom, lifetime, current: () => model.scene.maxReach, set: value => { if (sceneCommands.setMaxReach(value)) { rendering.build(); inspector.update(true); } } });
        bindDrawingsViewer({ dom, lifetime, scene: () => model.scene, closeMenu: () => shell.closeDD() });
        bindDesignImageViewer({ dom, lifetime, capture: () => {
            const design = structuredClone(model.scene);
            if (!design.wardrobes.length) throw new DesignImageUserError('EMPTY_DESIGN');
            const specification = imageDesignSpecification(design);
            const references = captureDesignReferences({
                renderer: resources.R, scene: resources.scene, document: dom.host.ownerDocument,
                groups: renderState.wardrobeGroups, ground: resources.ground, settling: renderState.settling,
                design,
            });
            return { specification, references };
        } });
        shapeInspector.bind((target, type, handler) => lifetime.listen(target, type, handler));
        studioPanel.bind((target, type, handler) => lifetime.listen(target, type, handler));
        kitchenPanel.bind((target, type, handler) => lifetime.listen(target, type, handler));
        rendering.theme();

        // Keep the default Wardrobe dock, with the wider framing used by an empty-canvas tap.
        camera.frameScene({ instant: true });
        camera.resize();
        inspector.update(true);
        rendering.loop();
        const clothingWarmup = createClothingWarmup(resources.R, resources.scene, resources.cam, dom.host.ownerDocument);
        lifetime.cleanup(() => clothingWarmup.dispose());
        // Two frames allow the initial view to paint before preparing first-use cloth programs.
        lifetime.frame(() => lifetime.frame(() => clothingWarmup.prepare()));
        /** Puts a whole design in the editor (one an agent built, or an import) as one undo step, framed whole. */
        function replaceDesign(project: ProjectDocument) {
            const next = projectToScene(project) ?? createEditorModel().scene;
            history.checkpoint(model.snapshot());
            model.restore(JSON.stringify(next));
            selectionState.room = null;
            selectionState.pendingStudioAction = null;
            inspector.hidePop();
            inspector.clearFocus();
            inspector.update(true);
            inspector.histUI();
            camera.frameScene();
        }
        return {
            snapshot: model.snapshot, viewport, replaceDesign, scene: () => model.scene,
            notify: (message: string) => shell.toast(message, undefined, 12000),
            preview: () => capturePreview(
                resources.R, resources.scene, resources.cam, dom.host.ownerDocument,
                camera.sceneBox(), camera.cameraFitDistance, (model.activeCabinet().angle ?? 0) * Math.PI / 180,
            ),
            dispose: () => viewport.dispose(),
        };
    }
    catch (error) {
        lifetime.dispose();
        throw error;
    }
}
