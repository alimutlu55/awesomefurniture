import { renderFixtures } from './studio-2d-fixtures';
import { createPlanRotation, rotationHandle } from './studio-2d-rotate';
import { STUDIO_LIMITS, studioBounds, wallLine } from '../../domain/studio/studio';
import { splitWall } from '../../domain/studio/studio-edit';
import { detectRooms, stepStudioWall } from '../../domain/studio/studio-plan';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { RoomSelection } from '../viewport/studio-renderer';
import { buildDefsSvg, createTransform, renderFurniture, renderHandles, renderOpenings, renderOverlays, renderRooms, renderWalls, type ViewportTransform } from './studio-2d-canvas';
import { createStudio2DGestures } from './studio-2d-gestures';
import { layoutPlanLabels, renderPlanLabels, type LabelRect } from './studio-2d-labels';
export interface Studio2DPlannerPorts {
  readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
  readonly model: { scene: EditorScene; snapshot(): string; restore(s: string): void };
  readonly sceneCommands: Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>,
    'editStudio' | 'standingAgainst' | 'carryWardrobes' | 'previewTranslation' | 'previewRotation' | 'restorePose' | 'settleCabinet' | 'studioProblem' | 'followCeilings'>;
  readonly history: { checkpoint(snapshot: string): void };
  readonly selectionState: {
    viewMode?: 'studio' | 'furniture';
    studioView?: '2d' | '3d';
    room?: RoomSelection;
    focusOn?: boolean;
  };
  readonly callbacks: {
    onSwitch3D?: () => void;
    selectionChanged: () => void;
    clearFurnitureFocus: () => void;
  };
  readonly listen: (target: EventTarget, type: string, handler: (e: Event) => void, options?: boolean | AddEventListenerOptions) => void;
  readonly observe: ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>['observe'];
}
export function createStudio2DPlanner({ dom, model, sceneCommands, history, selectionState, callbacks, listen, observe }: Studio2DPlannerPorts) {
  const { $, document } = dom;
  let transform: ViewportTransform = { panX: 0, panZ: 0, zoom: 0.9, width: 800, height: 600 };
  const root = document.createElement('div');
  root.id = 'studio-2d-planner';
  root.className = 'studio-2d-planner';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', '2D Space Planner');
  root.innerHTML = `
    <svg id="sp2d-svg" class="sp2d-svg" tabindex="0">
      <defs id="sp2d-defs">${buildDefsSvg()}</defs>
      <rect id="sp2d-grid-rect" width="100%" height="100%" fill="url(#sp2d-pat-major)"/>
      <g id="sp2d-world">
        <g id="sp2d-rooms"></g>
        <g id="sp2d-walls"></g>
        <g id="sp2d-openings"></g>
        <g id="sp2d-fixtures"></g><g id="sp2d-furniture"></g>
        <g id="sp2d-handles"></g>
        <g id="sp2d-guides"></g>
        <g id="sp2d-draw-preview"></g>
      </g>
      <g id="sp2d-overlays"></g><g id="sp2d-rotation"></g>
      <g id="sp2d-text-labels"></g>
    </svg>
    <div class="sp2d-action-pill" id="sp2d-action-pill" hidden></div>
  `;
  $('#view').appendChild(root);
  const svg = root.querySelector<SVGSVGElement>('#sp2d-svg')!;
  const pillEl = root.querySelector<HTMLElement>('#sp2d-action-pill')!;
  const worldGroup = svg.querySelector<SVGGElement>('#sp2d-world')!;
  const roomsGroup = svg.querySelector<SVGGElement>('#sp2d-rooms')!;
  const wallsGroup = svg.querySelector<SVGGElement>('#sp2d-walls')!;
  const openingsGroup = svg.querySelector<SVGGElement>('#sp2d-openings')!;
  const fixturesGroup = svg.querySelector<SVGGElement>('#sp2d-fixtures')!;
  const rotationGroup = svg.querySelector<SVGGElement>('#sp2d-rotation')!;
  const furnGroup = svg.querySelector<SVGGElement>('#sp2d-furniture')!;
  const handlesGroup = svg.querySelector<SVGGElement>('#sp2d-handles')!;
  const guidesGroup = svg.querySelector<SVGGElement>('#sp2d-guides')!;
  const drawPreviewGroup = svg.querySelector<SVGGElement>('#sp2d-draw-preview')!;
  const overlaysGroup = svg.querySelector<SVGGElement>('#sp2d-overlays')!;
  const textLabels = svg.querySelector<SVGGElement>('#sp2d-text-labels')!;
  const textMeasure = document.createElement('canvas').getContext('2d');
  if (textMeasure) textMeasure.font = '600 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  const patMajor = svg.querySelector<SVGPatternElement>('#sp2d-pat-major')!;
  const gestures = createStudio2DGestures({
    getStudio: () => model.scene.studio ?? null,
    getWardrobes: () => model.scene.wardrobes,
    getActiveWardrobe: () => model.scene.activeWardrobe,
    setActiveWardrobe: id => { model.scene.activeWardrobe = id; selectionState.focusOn = true; callbacks.selectionChanged(); },
    getSelection: () => selectionState.room ?? null,
    setSelection: s => { callbacks.clearFurnitureFocus(); selectionState.room = s; callbacks.selectionChanged(); },
    editStudio: (fn, rec, q) => sceneCommands.editStudio(fn, rec, q),
    snapshot: () => model.snapshot(),
    restore: snapshot => model.restore(snapshot),
    checkpoint: snapshot => history.checkpoint(snapshot),
    committed: () => { sceneCommands.followCeilings(true); callbacks.selectionChanged(); },
    previewTranslation: (id, pose) => sceneCommands.previewTranslation(id, pose),
    settleCabinet: id => sceneCommands.settleCabinet(id),
    studioProblem: (studio, carry) => sceneCommands.studioProblem(studio, carry),
    previewStudio: (studio, carry) => {
      model.scene.studio = studio;
      if (carry) sceneCommands.carryWardrobes(carry, studio);
      sceneCommands.followCeilings(false);
    },
    refresh: () => render(),
    fitScene: () => fitScene(),
    getTransform: () => transform,
    setTransform: updater => { transform = updater(transform); },
    standingAgainst: wid => sceneCommands.standingAgainst(wid),
  });
  const activePiece = () => selectionState.focusOn && !selectionState.room
    ? model.scene.wardrobes.find(c => c.id === model.scene.activeWardrobe) : undefined;
  const rotation = createPlanRotation({ cabinet: activePiece, transform: () => transform,
    snapshot: () => model.snapshot(), checkpoint: s => history.checkpoint(s),
    previewRotation: (id, angle, from) => sceneCommands.previewRotation(id, angle, from),
    restorePose: (id, from) => sceneCommands.restorePose(id, from), settleCabinet: id => sceneCommands.settleCabinet(id),
    refresh: () => { callbacks.selectionChanged(); render(); },
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
  let lastRoomCount = 0;
  let lastStudioSnapshot = '';
  let lastSelectionKey = '';
  let lastWardrobesSnapshot = '';
  let lastHandleZoom = 0;
  let lastHandlesStudio = '';
  let lastHandlesSelection = '';
  function render() {
    updateSize();
    const studio = model.scene.studio;
    const count = studio ? detectRooms(studio).length : 0;
    const added = count > lastRoomCount; lastRoomCount = count;
    if (added && selectionState.studioView === '2d') { fitScene(); return; }
    const sel = selectionState.room ?? null;
    const actCab = selectionState.focusOn && !sel ? model.scene.activeWardrobe : null;
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
    const ze = dom.document?.getElementById('zoom-val') ?? root.ownerDocument?.getElementById('zoom-val');
    if (ze) ze.textContent = `${Math.round(transform.zoom * 100)}%`;
    // Only rebuild geometry DOM when studio, selection, or wardrobes change
    const studioSnap = JSON.stringify(studio);
    const selKey = sel ? `${sel.kind}_${sel.id}` : 'none';
    const wardSnap = `${actCab}_${model.scene.wardrobes.map(w => `${w.id}_${w.x}_${w.z}_${w.angle}_${w.state.w}_${w.state.d}`).join(';')}`;
    if (studioSnap !== lastStudioSnapshot || selKey !== lastSelectionKey) {
      lastStudioSnapshot = studioSnap;
      lastSelectionKey = selKey;
      fixturesGroup.innerHTML = studio ? renderFixtures(studio, sel) : '';
      roomsGroup.innerHTML = studio ? renderRooms(studio) : '';
      wallsGroup.innerHTML = studio ? renderWalls(studio, sel) : '';
      openingsGroup.innerHTML = studio ? renderOpenings(studio, sel) : '';
    }
    if (studioSnap !== lastHandlesStudio || selKey !== lastHandlesSelection || transform.zoom !== lastHandleZoom) {
      lastHandlesStudio = studioSnap;
      lastHandlesSelection = selKey;
      lastHandleZoom = transform.zoom;
      handlesGroup.innerHTML = studio ? renderHandles(studio, sel, transform.zoom) : '';
    }
    if (wardSnap !== lastWardrobesSnapshot) {
      lastWardrobesSnapshot = wardSnap;
      furnGroup.innerHTML = renderFurniture(model.scene.wardrobes, actCab);
    }
    const piece = activePiece();
    rotationGroup.innerHTML = piece ? rotationHandle(piece, transform, rotation.active()) : '';
    // Dynamic guides during drag
    const guides = gestures.getGuides();
    if (guides.length) {
      guidesGroup.innerHTML = guides.map(g => `
        <line x1="${g.a.x}" y1="${g.a.z}" x2="${g.b.x}" y2="${g.b.z}" class="sp2d-guide-line" vector-effect="non-scaling-stroke"/>
      `).join('');
    } else {
      guidesGroup.innerHTML = '';
    }
    // Dynamic wall drawing rubber band line
    const drawState = gestures.getWallDrawState();
    if (drawState) {
      const s1 = drawState.start, s2 = drawState.current;
      drawPreviewGroup.innerHTML = `
        <line x1="${s1.x}" y1="${s1.z}" x2="${s2.x}" y2="${s2.z}" class="sp2d-draw-line" vector-effect="non-scaling-stroke"/>
        <circle cx="${s1.x}" cy="${s1.z}" r="5" class="sp2d-draw-node" vector-effect="non-scaling-stroke"/>
        <circle cx="${s2.x}" cy="${s2.z}" r="5" class="sp2d-draw-node" vector-effect="non-scaling-stroke"/>
      `;
    } else {
      drawPreviewGroup.innerHTML = '';
    }
    // Offer additions at the tapped position, rather than a fixed midpoint.
    const actionTarget = gestures.getWallActionTarget();
    if (sel?.kind === 'wall' && studio && actionTarget?.wallId === sel.id) {
      const w = studio.walls.find(x => x.id === sel.id);
      const line = w && wallLine(studio, w);
      if (line) {
        const { toScreen } = createTransform(transform);
        const scr = toScreen({ x: line.a.x + line.ux * actionTarget.at, z: line.a.z + line.uz * actionTarget.at });
        const canInsert = actionTarget.at >= STUDIO_LIMITS.minWallLength && line.length - actionTarget.at >= STUDIO_LIMITS.minWallLength;
        const canStep = canInsert && stepStudioWall(studio, w.id, 50, actionTarget.at / line.length) !== null;
        pillEl.innerHTML = `
          <button type="button" data-sp2d-act="step" ${!canStep ? 'disabled' : ''}>+ Step</button>
          <button type="button" data-sp2d-act="point" ${!canInsert ? 'disabled' : ''}>+ Point</button>
        `;
        pillEl.style.left = `${Math.max(90, Math.min(transform.width - 90, scr.x))}px`;
        pillEl.style.top = `${Math.max(65, Math.min(transform.height - 35, scr.z - 36))}px`;
        pillEl.hidden = false;
      } else {
        pillEl.hidden = true;
      }
    } else {
      pillEl.hidden = true;
    }
    const viewport = svg.getBoundingClientRect();
    const controls: (Element | null)[] = [$('#view-modes'), $('#topright'), $('#toolbar'), $('#left'),
      pillEl, rotationGroup,
      ...svg.querySelectorAll('.sp2d-compass,.sp2d-scale-bar')];
    // The format selector is a child of the editing tabs, outside the planner root.
    controls.push($('#view-modes').querySelector('.studio-format-seg'));
    const exclusions: LabelRect[] = controls.flatMap(control => {
      if (!control) return [];
      const style = root.ownerDocument.defaultView?.getComputedStyle(control);
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') return [];
      const r = control.getBoundingClientRect();
      return r.width && r.height ? [{ x: r.left - viewport.left, y: r.top - viewport.top, width: r.width, height: r.height }] : [];
    });
    const markup = renderPlanLabels(layoutPlanLabels({ studio: studio ?? null, wardrobes: model.scene.wardrobes,
      transform, selection: sel, activeCabinet: actCab, guides, drawing: drawState, exclusions,
      ...(textMeasure ? { measureText: (text: string) => textMeasure.measureText(text).width } : {}),
    }));
    if (textLabels.innerHTML !== markup) textLabels.innerHTML = markup;
  }
  listen(svg, 'pointerdown', (e: Event) => {
    const pointer = e as PointerEvent;
    if (rotation.down(pointer, svg) || gestures.onPointerDown(pointer, svg)) svg.setPointerCapture(pointer.pointerId);
  });
  listen(svg, 'pointermove', (e: Event) => rotation.active() ? rotation.move(e as PointerEvent, svg) : gestures.onPointerMove(e as PointerEvent, svg));
  listen(svg, 'pointerup', (e: Event) => {
    if (rotation.active()) rotation.finish(); else gestures.onPointerUp(e as PointerEvent);
  });
  listen(svg, 'pointercancel', (e: Event) => {
    rotation.finish(true); gestures.onPointerUp(e as PointerEvent, true);
    gestures.clearWallActionTarget();
  });
  listen(svg, 'lostpointercapture', () => { rotation.finish(true); gestures.onPointerUp(undefined, true); });
  listen(svg, 'wheel', (e: Event) => gestures.onWheel(e as WheelEvent, svg), { passive: false });
  listen(svg, 'keydown', (e: Event) => {
    const key = e as KeyboardEvent, handle = (e.target as Element).closest('[data-extend-id]');
    if (!handle || (key.key !== 'Enter' && key.key !== ' ')) return;
    key.preventDefault(); key.stopPropagation();
    gestures.extendWall(handle.getAttribute('data-extend-id')!);
  });
  // Contextual Step and Point actions
  listen(root, 'click', (e: Event) => {
    const actBtn = (e.target as Element).closest<HTMLButtonElement>('[data-sp2d-act]');
    if (actBtn) {
      const act = actBtn.dataset.sp2dAct;
      const target = gestures.getWallActionTarget();
      if (!target || actBtn.disabled) return;
      const { wallId, at } = target;
      const changed = sceneCommands.editStudio(s => {
        const w = s.walls.find(w => w.id === wallId);
        const line = w && wallLine(s, w);
        if (!line) return null;
        if (act === 'step') return stepStudioWall(s, wallId, 50, at / line.length);
        if (act === 'point') return splitWall(s, wallId, at);
        return null;
      }, true);
      if (changed) {
        gestures.clearWallActionTarget();
        if (act === 'step') selectionState.room = null;
        callbacks.selectionChanged();
      }
      render();
      return;
    }
  });
  listen(window, 'blur', () => { rotation.finish(true); gestures.onPointerUp(undefined, true); });
  // Panels and toolbars can resize without a window resize (including animated mobile sheets).
  if (typeof ResizeObserver !== 'undefined') {
    const resize = new ResizeObserver(() => {
      if (selectionState.viewMode === 'studio' && selectionState.studioView === '2d') render();
    });
    for (const target of [svg, $('#view-modes'), $('#topright'), $('#toolbar')]) observe(resize, target);
  }
  listen(window, 'resize', () => {
    if (selectionState.viewMode === 'studio' && selectionState.studioView === '2d') {
      updateSize();
      render();
    }
  });
  listen(window, 'keydown', (e: Event) => {
    const ke = e as KeyboardEvent;
    if (selectionState.viewMode !== 'studio' || selectionState.studioView !== '2d') return;
    if ((ke.target as Element).closest('input,textarea,select,[contenteditable]')) return;
    if (ke.key.toLowerCase() === 'r' && !ke.metaKey && !ke.ctrlKey && !ke.altKey && activePiece()) {
      ke.preventDefault(); ke.stopImmediatePropagation(); rotation.quarterTurn();
    }
    else if (ke.key === 'Escape') {
      if (rotation.active()) { ke.preventDefault(); ke.stopImmediatePropagation(); rotation.finish(true); return; } gestures.onPointerUp(undefined, true); gestures.cancelDrawing(); svg.classList.remove('drawing-wall'); }
    else if (ke.key === 'w' || ke.key === 'W') { gestures.setTool('wall'); svg.classList.add('drawing-wall'); }
    else if (ke.key === 'v' || ke.key === 'V') { gestures.setTool('select'); svg.classList.remove('drawing-wall'); }
  }, true);
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
      root.hidden = false;
      fitScene();
    },
    hide() {
      rotation.finish(true);
      gestures.onPointerUp(undefined, true);
      gestures.cancelDrawing();
      svg.classList.remove('drawing-wall');
      root.hidden = true;
    },
  };
}
