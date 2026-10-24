const THREE = require('three');
const { createEditorState } = require('../../src/application/projects/editor-state.ts');
const { createEditorModel } = require('../../src/application/projects/editor-model.ts');
const { createSceneCommands } = require('../../src/application/commands/scene-commands.ts');
const { createStudioEditor } = require('../../src/presentation/editor/studio-editor.ts');
const { createShapeInspector } = require('../../src/presentation/editor/shape-inspector.ts');
const { createCabinetRenderer } = require('../../src/presentation/viewport/cabinet-renderer.js');
const { createRenderState } = require('../../src/presentation/viewport/render-state.js');
const { createSelectionState } = require('../../src/presentation/editor/selection-state.js');
const { createInteractionState } = require('../../src/presentation/editor/interaction-state.js');
const { createCameraState } = require('../../src/presentation/viewport/camera-state.ts');
const { rectangleStudio } = require('../../src/domain/studio/studio-templates.ts');
const { createSceneHistory } = require('../../src/application/history/scene-history.ts');
const { createShapeSession } = require('../../src/presentation/editor/surface-shape-session.ts');
const { surfaceProfile } = require('../../src/domain/studio/surface-profile.ts');

/** Minimal DOM for production renderer tests. Removing a captured node loses its pointer,
 * as in the browser; drawing meshes uses real Three.js geometry without a WebGL context. */
class Node {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
        this.dataset = {}; this.style = { setProperty(k, v) { this[k] = v; } }; this.attributes = new Map();
        this.className = ''; this.innerHTML = ''; this.offsetWidth = 28; this.offsetHeight = 20; this.captured = null;
        this.classList = {
            contains: c => this.className.split(/\s+/).includes(c),
            add: (...cs) => { this.className = [...new Set([...this.className.split(/\s+/), ...cs])].join(' '); },
            remove: (...cs) => { this.className = this.className.split(/\s+/).filter(c => !cs.includes(c)).join(' '); },
            toggle: (c, on) => { if (on ?? !this.classList.contains(c)) this.classList.add(c); else this.classList.remove(c); }
        };
    }
    get isConnected() { return this.root || !!this.parentElement?.isConnected; }
    get firstChild() { return this.children[0]; }
    get firstElementChild() { return this.firstChild; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 720, width: 1280, height: 720 }; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    removeAttribute(k) { this.attributes.delete(k); }
    toggleAttribute(k, on) { if (on ?? !this.attributes.has(k)) this.attributes.set(k, ''); else this.attributes.delete(k); }
    appendChild(node) { if (node.parentElement) node.remove(); this.children.push(node); node.parentElement = this; return node; }
    prepend(node) { this.appendChild(node); this.children.unshift(this.children.pop()); }
    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null;
        if (this.captured !== null) { this.captured = null; queueMicrotask(() => this.onlostpointercapture?.()); }
    }
    setPointerCapture(id) { this.captured = id; }
    hasPointerCapture(id) { return this.captured === id; }
    releasePointerCapture() { this.captured = null; }
    matches(selector) { return selector.split(',').some(s => /^\.[\w-]+$/.test(s) && this.classList.contains(s.slice(1))); }
    querySelector(selector) {
        const key = /^\[data-ib="([^"]+)"\]$/.exec(selector)?.[1];
        return key ? this.children.find(child => child.dataset.ib === key) ?? null : null;
    }
    querySelectorAll() { return []; }
    getContext() { return { fillRect() {}, createLinearGradient: () => ({ addColorStop() {} }) }; }
}

exports.roomRenderFixture = function (t, { run = 'along', width = 1280, wardrobes = 1 } = {}) {
    const studio = rectangleStudio(400, 160);
    studio.ceilings = [{ id: 'k1', wall: 'w1', run, depth: 160, profile: run === 'along'
        ? [{ t: 6, y: 205 }, { t: 176, y: 205 }, { t: 306, y: 100 }, { t: 406, y: 100 }]
        : [{ t: 0, y: 100 }, { t: 160, y: 260 }] }];
    const model = createEditorModel({ studio, wardrobes: Array.from({ length: wardrobes }, (_, i) => ({
        id: i + 1, name: 'W' + (i + 1), x: i ? 140 : -60, y: 0, z: 30, angle: 0,
        state: { ...createEditorState(), w: i ? 80 : 160, n: 1 } })), activeWardrobe: wardrobes ? 1 : 0, nextWardrobeId: wardrobes + 1 });
    const checkpoints = [], messages = [], history = createSceneHistory(() => model.snapshot(), s => model.restore(s));
    const checkpoint = (s = model.snapshot()) => { checkpoints.push(s); history.checkpoint(s); };
    const commands = createSceneCommands(() => model.scene, { checkpoint, report: m => messages.push(m) });
    commands.followCeilings();
    const selectionState = createSelectionState(); selectionState.room = { kind: 'ceiling', id: 'k1' };
    const renderState = createRenderState(), interactionState = createInteractionState(), cameraState = createCameraState();
    const nodes = Object.fromEntries(['app', 'labels', 'left', 'view', 'c'].map(k => [k, new Node()]));
    Object.values(nodes).forEach(n => { n.root = true; });
    const document = { createElement: tag => new Node(tag), createElementNS: (_ns, tag) => new Node(tag),
        getElementById: id => nodes[id] ?? null, querySelector: () => null, querySelectorAll: () => [] };
    const previousDocument = global.document; global.document = document;
    t.after(() => { global.document = previousDocument; });
    const dom = { width, document, $: s => nodes[s.slice(1)] ??= new Node(), matchMedia: () => ({ matches: false }),
        setId: (el, id) => { el.id = id; nodes[id] = el; } };
    const material = color => new THREE.MeshStandardMaterial({ color });
    const resources = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, 1280 / 720, 1, 15000), cv: nodes.c,
        contact: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material('#fff')), HM: material('#fff'), aoTexture: new THREE.Texture(),
        M: material, wood: material, shade: c => c, softArea: (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), material('#fff')) };
    resources.cam.position.set(100, 180, 700); resources.cam.lookAt(0, 120, 0); resources.cam.updateMatrixWorld();
    let frontPoint = null;
    const picking = { frontPoint: () => frontPoint, groundPoint: e => ({ x: e.clientX, z: e.clientY }),
        screenPoint: p => ({ x: p.x + p.z * .4, y: -p.y + p.z * .3 }) };
    const disposers = [], lifetime = { cleanup: fn => disposers.push(fn) };
    let renderer;
    const editor = createStudioEditor({ model, sceneCommands: commands, picking, selectionState,
        history: { checkpoint }, callbacks: { selectionChanged() {}, openFields() {}, histUI() {}, report: m => messages.push(m),
            redraw: () => renderer.redrawStudio(), rebuild: () => renderer.build(), refresh: () => renderer.build() } });
    const inspector = { inside: () => false, updateItemBar() {}, crumbUI() {}, measurementUI() {} };
    const shapeInspector = createShapeInspector({ dom, model, sceneCommands: commands, picking, selectionState,
        callbacks: { rebuild: () => renderer.build(), refresh: () => renderer.build(), histUI() {} } });
    renderer = createCabinetRenderer({ dom, model, resources, renderState, interactionState, selectionState, cameraState,
        inspector, shapeInspector, picking, studioEditor: editor, settings: { budget: 900 }, lifetime, shellState: {}, commands: {} });
    renderer.build();
    t.after(() => { disposers.forEach(fn => fn()); });
    /** The Shape editor's drag of one corner of the ceiling's outline: `move(index, to)` previews it, `end` commits. */
    const shaping = (ref = { kind: 'ceiling', id: 'k1' }) => {
        const session = createShapeSession({ model, sceneCommands: commands, history: { checkpoint },
            callbacks: { redraw: () => renderer.redrawStudio(), rebuild: () => renderer.build(), refresh: () => renderer.build(), report: m => messages.push(m), history() {} } });
        session.begin(ref);
        const start = surfaceProfile(model.scene.studio, ref).points;
        return { session, start, move: (index, to) => session.preview(start.map((p, k) => k === index ? { ...p, ...to } : p)), end: () => session.end(), cancel: () => session.cancel() };
    };
    const event = (pointerType = 'mouse', x = 0, y = 0) => ({ pointerId: 1, pointerType, button: 0, clientX: x, clientY: y,
        shiftKey: true, preventDefault() {}, stopPropagation() {} });
    return { model, commands, editor, renderer, shapeInspector, inspector, interactionState, selectionState, renderState, nodes, checkpoints, history, messages, shaping, event,
        point: p => { frontPoint = p; } };
};
