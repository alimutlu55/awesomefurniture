import type { EditorScene } from '../../application/projects/editor-scene';
import type { createEditorDom } from './editor-dom';
import { createModulePort } from './module-port';
import { createScenePicking } from './scene-picking.js';
import { createThreeViewport } from '../viewport/three-viewport';
import { applyViewportSession } from '../viewport/project-view';
import { projectToScene } from '../../application/projects/editor-mapper';
import { createViewportResources } from '../viewport/viewport-resources.js';
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
export function startEditor(initialScene: EditorScene | undefined, dom: ReturnType<typeof createEditorDom>) {
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
    const plannerState = createPlannerState();
    const shellState = createShellState();
    try {
        const resources = createViewportResources($('#c'));
        lifetime.cleanup(() => resources.dispose());
        const history = createSceneHistory(model.snapshot, model.restore);
        const geometry = createWardrobeGeometry(() => model.activeCabinet().state, () => settings.budget);
        const cabinetGeometry = createCabinetGeometry(() => model.scene.wardrobes);
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
                inspector.hidePop();
                inspector.update(true);
                if (session.openPanel === 'planner') {
                    planner.openWizard();
                }
                else if (session.openPanel === 'properties') {
                    inspector.showPop(null, model.activeCabinet().state.divider >= 0 ? '#pop4' : model.activeCabinet().state.item >= 0 ? '#pop3' : '#pop2');
                }
                if (session.tool === 'move' && model.activeCabinet().state.item >= 0) {
                    interactions.armMovement('move');
                }
            },
            resizeSurface: (width, height) => {
                resources.R.setSize(width, height);
                camera.applyView();
                // Resizing clears the WebGL drawing buffer. Repaint before the browser
                // composites the animated sheet resize, rather than leaving a blank frame.
                resources.R.render(resources.scene, resources.cam);
            },
            disposeResources: () => lifetime.dispose()
        });
        const shapeInspector = createShapeInspector({ dom, model, sceneCommands, picking, selectionState, callbacks: { refresh: () => inspector.update(true), rebuild: () => rendering.build(), histUI: () => inspector.histUI() } });
        cameraPort.connect(createCameraController({ dom, inspector, picking, cameraState, interactionState, renderState, geometry, cabinetGeometry, resources, model, viewport }));
        renderingPort.connect(createCabinetRenderer({ dom, camera, interactions, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, resources, model, commands, settings, lifetime, shapeInspector }));
        interactionsPort.connect(createEditorGestures({ dom, camera, rendering, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, geometry, cabinetGeometry, resources, model, commands, sceneCommands, history }));
        inspectorPort.connect(createInspectorPresenter({ dom, elements, camera, rendering, interactions, planner, shell, cameraState, interactionState, renderState, selectionState, shellState, geometry, resources, model, commands, sceneCommands, history, shapeInspector }));
        plannerPort.connect(createPlannerPresenter({ dom, inspector, shell, plannerState, geometry, model, commands, plannerService, lifetime }));
        shellPort.connect(createEditorShell({ dom, shellState, geometry, model, lifetime, elements }));
        mountEditorBindings({ dom, picking, camera, rendering, interactions, inspector, planner, shell, cameraState, interactionState, renderState, selectionState, plannerState, shellState, geometry, resources, model, commands, sceneCommands, history, lifetime, elements });
        shapeInspector.bind((target, type, handler) => lifetime.listen(target, type, handler));
        rendering.theme();

        camera.fit({ instant: true, padding: 1.4 });
        cameraState.tgt.y = cameraState.tgtY;
        camera.resize();
        inspector.update(true);
        rendering.loop();
        return { snapshot: model.snapshot, viewport, dispose: () => viewport.dispose() };
    }
    catch (error) {
        lifetime.dispose();
        throw error;
    }
}
