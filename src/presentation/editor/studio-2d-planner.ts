import type { Studio } from '../../domain/studio/studio';
import { studioBounds } from '../../domain/studio/studio';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { RoomSelection } from '../viewport/studio-renderer';
import { buildDefsSvg, createTransform, renderFurniture, renderHandles, renderOpenings, renderOverlays, renderRooms, renderWalls, type ViewportTransform } from './studio-2d-canvas';
import { renderLeftRuler, renderTopRuler } from './studio-2d-rulers';
import { createStudio2DGestures } from './studio-2d-gestures';

export interface Studio2DPlannerPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly model: { scene: EditorScene; snapshot(): string; restore(s: string): void };
  readonly sceneCommands: {
    editStudio: (edit: (s: Studio) => Studio | null, record?: boolean, quiet?: boolean) => boolean;
    standingAgainst: (wallId: string) => import('../../application/commands/studio-commands').Carried;
    carryWardrobes: (carried: import('../../application/commands/studio-commands').Carried, next: Studio) => void;
    wallSnap: (cab: import('../../application/projects/editor-scene').EditorCabinet, pose: { x: number; z: number; angle: number }) => { x: number; z: number; angle: number } | null;
  };
  readonly history: { checkpoint(snapshot: string): void };
  readonly selectionState: {
    viewMode?: 'studio' | 'furniture';
    studioView?: '2d' | '3d';
    room?: RoomSelection;
  };
  readonly callbacks: {
    onSwitch3D?: () => void;
    openFields: (action: string, field: string) => void;
    selectionChanged: () => void;
  };
  readonly listen: (target: EventTarget, type: string, handler: (e: Event) => void, options?: boolean | AddEventListenerOptions) => void;
}

export function createStudio2DPlanner({ dom, model, sceneCommands, history, selectionState, callbacks, listen }: Studio2DPlannerPorts) {
  const { $, document } = dom;
  let transform: ViewportTransform = { panX: 0, panZ: 0, zoom: 0.9, width: 800, height: 600 };

  const root = document.createElement('div');
  root.id = 'studio-2d-planner';
  root.className = 'studio-2d-planner';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', '2D Space Planner');

  root.innerHTML = `
    <div class="sp2d-top-ruler-container" id="sp2d-top-ruler"></div>
    <div class="sp2d-left-ruler-container" id="sp2d-left-ruler"></div>
    <svg id="sp2d-svg" class="sp2d-svg" tabindex="0">
      <defs id="sp2d-defs">${buildDefsSvg()}</defs>
      <rect id="sp2d-grid-rect" width="100%" height="100%" fill="url(#sp2d-pat-major)"/>
      <g id="sp2d-world">
        <g id="sp2d-rooms"></g>
        <g id="sp2d-walls"></g>
        <g id="sp2d-openings"></g>
        <g id="sp2d-furniture"></g>
        <g id="sp2d-handles"></g>
        <g id="sp2d-guides"></g>
        <g id="sp2d-draw-preview"></g>
      </g>
      <g id="sp2d-overlays"></g>
    </svg>
    <div class="sp2d-floating-toolbar">
      <div class="sp2d-tool-group" role="group" aria-label="Drafting tools">
        <button type="button" class="sp2d-btn active" data-tool="select" title="Select & Move (V)">
          <svg class="ic" viewBox="0 0 24 24"><path d="M4 4l7 17 2.5-6.5L20 12z"/></svg>
          <span>Select</span>
        </button>
        <button type="button" class="sp2d-btn" data-tool="wall" title="Draw Wall (W)">
          <svg class="ic" viewBox="0 0 24 24"><path d="M3 9h18v6H3zM8 9v6M13 9v6M18 9v6"/></svg>
          <span>Draw wall</span>
        </button>
      </div>
    </div>
    <div class="sp2d-coords" id="sp2d-coords">X: 0 cm · Z: 0 cm</div>
  `;

  $('#view').appendChild(root);
  const svg = root.querySelector<SVGSVGElement>('#sp2d-svg')!;
  const topRulerEl = root.querySelector<HTMLElement>('#sp2d-top-ruler')!;
  const leftRulerEl = root.querySelector<HTMLElement>('#sp2d-left-ruler')!;
  const coordsEl = root.querySelector<HTMLElement>('#sp2d-coords')!;

  const worldGroup = svg.querySelector<SVGGElement>('#sp2d-world')!;
  const roomsGroup = svg.querySelector<SVGGElement>('#sp2d-rooms')!;
  const wallsGroup = svg.querySelector<SVGGElement>('#sp2d-walls')!;
  const openingsGroup = svg.querySelector<SVGGElement>('#sp2d-openings')!;
  const furnGroup = svg.querySelector<SVGGElement>('#sp2d-furniture')!;
  const handlesGroup = svg.querySelector<SVGGElement>('#sp2d-handles')!;
  const guidesGroup = svg.querySelector<SVGGElement>('#sp2d-guides')!;
  const drawPreviewGroup = svg.querySelector<SVGGElement>('#sp2d-draw-preview')!;
  const overlaysGroup = svg.querySelector<SVGGElement>('#sp2d-overlays')!;
  const patMajor = svg.querySelector<SVGPatternElement>('#sp2d-pat-major')!;

  const gestures = createStudio2DGestures({
    getStudio: () => model.scene.studio ?? null,
    getWardrobes: () => model.scene.wardrobes,
    getActiveWardrobe: () => model.scene.activeWardrobe,
    setActiveWardrobe: id => { model.scene.activeWardrobe = id; callbacks.selectionChanged(); },
    getSelection: () => selectionState.room ?? null,
    setSelection: s => { selectionState.room = s; callbacks.selectionChanged(); },
    editStudio: (fn, rec, q) => sceneCommands.editStudio(fn, rec, q),
    checkpoint: () => history.checkpoint(model.snapshot()),
    refresh: () => render(),
    openFields: (a, f) => callbacks.openFields(a, f),
    getTransform: () => transform,
    setTransform: updater => { transform = updater(transform); },
    standingAgainst: wid => sceneCommands.standingAgainst(wid),
    carryWardrobes: (c, s) => sceneCommands.carryWardrobes(c, s),
    wallSnap: (cab, pose) => sceneCommands.wallSnap(cab, pose),
  });

  function updateSize() {
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      transform = { ...transform, width: rect.width, height: rect.height };
    }
  }

  function fitScene() {
    updateSize();
    const studio = model.scene.studio;
    const bounds = studio && studio.corners.length ? studioBounds(studio) : null;
    if (!bounds) {
      transform = { ...transform, panX: 0, panZ: 0, zoom: 0.9 };
      render();
      return;
    }
    const sceneW = Math.max(200, bounds.x1 - bounds.x0 + 160);
    const sceneD = Math.max(200, bounds.z1 - bounds.z0 + 160);
    const zoomX = (transform.width - 80) / sceneW;
    const zoomZ = (transform.height - 80) / sceneD;
    const fitZoom = Math.min(2.5, Math.max(0.2, Math.min(zoomX, zoomZ)));
    transform = {
      ...transform,
      panX: (bounds.x0 + bounds.x1) / 2,
      panZ: (bounds.z0 + bounds.z1) / 2,
      zoom: fitZoom,
    };
    render();
  }

  let lastStudioSnapshot = '';
  let lastSelectionKey = '';
  let lastWardrobesSnapshot = '';

  function render(cursorSceneX?: number, cursorSceneZ?: number) {
    updateSize();
    const studio = model.scene.studio;
    const sel = selectionState.room ?? null;
    const actCab = model.scene.activeWardrobe;

    // Fast GPU transform update on world group
    const cx = transform.width / 2, cz = transform.height / 2;
    worldGroup.setAttribute('transform', `translate(${cx}, ${cz}) scale(${transform.zoom}) translate(${-transform.panX}, ${-transform.panZ})`);

    // Shift GPU background grid pattern with 0 DOM node creation
    if (patMajor) {
      const offsetX = ((cx - transform.panX * transform.zoom) % (100 * transform.zoom) + 100 * transform.zoom) % (100 * transform.zoom);
      const offsetZ = ((cz - transform.panZ * transform.zoom) % (100 * transform.zoom) + 100 * transform.zoom) % (100 * transform.zoom);
      patMajor.setAttribute('patternTransform', `translate(${offsetX}, ${offsetZ}) scale(${transform.zoom})`);
    }

    // Update screen overlays (Compass & Scale bar)
    overlaysGroup.innerHTML = renderOverlays(transform);
    topRulerEl.innerHTML = renderTopRuler(transform, cursorSceneX);
    leftRulerEl.innerHTML = renderLeftRuler(transform, cursorSceneZ);
    const ze = dom.document?.getElementById('zoom-val') ?? root.ownerDocument?.getElementById('zoom-val');
    if (ze) ze.textContent = `${Math.round(transform.zoom * 100)}%`;

    // Only rebuild geometry DOM when studio, selection, or wardrobes change
    const studioSnap = JSON.stringify(studio);
    const selKey = sel ? `${sel.kind}_${sel.id}` : 'none';
    const wardSnap = `${actCab}_${model.scene.wardrobes.map(w => `${w.id}_${w.x}_${w.z}_${w.angle}_${w.state.w}_${w.state.d}`).join(';')}`;

    if (studioSnap !== lastStudioSnapshot || selKey !== lastSelectionKey) {
      lastStudioSnapshot = studioSnap;
      lastSelectionKey = selKey;
      roomsGroup.innerHTML = studio ? renderRooms(studio) : '';
      wallsGroup.innerHTML = studio ? renderWalls(studio, sel) : '';
      openingsGroup.innerHTML = studio ? renderOpenings(studio, sel) : '';
      handlesGroup.innerHTML = studio ? renderHandles(studio, sel) : '';
    }

    if (wardSnap !== lastWardrobesSnapshot) {
      lastWardrobesSnapshot = wardSnap;
      furnGroup.innerHTML = renderFurniture(model.scene.wardrobes, actCab);
    }

    // Dynamic guides during drag
    const guides = gestures.getGuides();
    if (guides.length) {
      guidesGroup.innerHTML = guides.map(g => `
        <line x1="${g.a.x}" y1="${g.a.z}" x2="${g.b.x}" y2="${g.b.z}" class="sp2d-guide-line" vector-effect="non-scaling-stroke"/>
        <text x="${g.b.x + 8}" y="${g.b.z - 8}" class="sp2d-guide-label">${g.label}</text>
      `).join('');
    } else {
      guidesGroup.innerHTML = '';
    }

    // Dynamic wall drawing rubber band line
    const drawState = gestures.getWallDrawState();
    if (drawState) {
      const s1 = drawState.start, s2 = drawState.current;
      const distCm = Math.round(Math.hypot(s2.x - s1.x, s2.z - s1.z));
      const mid = { x: (s1.x + s2.x) / 2, z: (s1.z + s2.z) / 2 };
      drawPreviewGroup.innerHTML = `
        <line x1="${s1.x}" y1="${s1.z}" x2="${s2.x}" y2="${s2.z}" class="sp2d-draw-line" vector-effect="non-scaling-stroke"/>
        <circle cx="${s1.x}" cy="${s1.z}" r="5" class="sp2d-draw-node" vector-effect="non-scaling-stroke"/>
        <circle cx="${s2.x}" cy="${s2.z}" r="5" class="sp2d-draw-node" vector-effect="non-scaling-stroke"/>
        <rect x="${mid.x - 30}" y="${mid.z - 12}" width="60" height="24" rx="4" class="sp2d-draw-tag-bg" vector-effect="non-scaling-stroke"/>
        <text x="${mid.x}" y="${mid.z + 4}" class="sp2d-draw-tag-text">${distCm} cm</text>
      `;
    } else {
      drawPreviewGroup.innerHTML = '';
    }
  }

  listen(svg, 'pointerdown', (e: Event) => gestures.onPointerDown(e as PointerEvent, svg));
  listen(svg, 'pointermove', (e: Event) => {
    const pe = e as PointerEvent;
    gestures.onPointerMove(pe, svg);
    const rect = svg.getBoundingClientRect();
    const { toScene } = createTransform(transform);
    const pt = toScene(pe.clientX - rect.left, pe.clientY - rect.top);
    coordsEl.textContent = `X: ${Math.round(pt.x)} cm · Z: ${Math.round(pt.z)} cm`;
  });
  listen(svg, 'pointerup', (e: Event) => gestures.onPointerUp(e as PointerEvent));
  listen(svg, 'pointercancel', (e: Event) => gestures.onPointerUp(e as PointerEvent));
  listen(svg, 'wheel', (e: Event) => gestures.onWheel(e as WheelEvent, svg), { passive: false });

  // Floating toolbar buttons
  listen(root, 'click', (e: Event) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === 'select' || tool === 'wall') {
      root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b === btn));
      gestures.setTool(tool);
      svg.classList.toggle('drawing-wall', tool === 'wall');
    }
  });

  listen(window, 'resize', () => {
    if (selectionState.studioView === '2d') {
      updateSize();
      render();
    }
  });

  listen(window, 'keydown', (e: Event) => {
    const ke = e as KeyboardEvent;
    if (selectionState.studioView !== '2d') return;
    if (ke.key === 'Escape') gestures.cancelDrawing();
    else if (ke.key === 'w' || ke.key === 'W') {
      const wallBtn = root.querySelector<HTMLButtonElement>('[data-tool="wall"]');
      wallBtn?.click();
    } else if (ke.key === 'v' || ke.key === 'V') {
      const selBtn = root.querySelector<HTMLButtonElement>('[data-tool="select"]');
      selBtn?.click();
    }
  });

  return {
    render,
    fitScene,
    zoomIn() {
      transform = { ...transform, zoom: Math.min(6.0, transform.zoom * 1.25) };
      render();
    },
    zoomOut() {
      transform = { ...transform, zoom: Math.max(0.15, transform.zoom * 0.8) };
      render();
    },
    getZoom() {
      return transform.zoom;
    },
    show() {
      root.style.display = 'block';
      fitScene();
    },
    hide() {
      root.style.display = 'none';
    },
  };
}
