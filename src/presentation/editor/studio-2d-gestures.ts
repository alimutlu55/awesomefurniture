import type { Studio, StudioWall } from '../../domain/studio/studio';
import { cornerDegree, nextId, wallLine } from '../../domain/studio/studio';
import { furthestValid, snapCorner } from './studio-drag';
import { extendFromCorner, moveWall } from '../../domain/studio/studio-edit';
import { attachPlanPoint, snapPlanCorner } from './studio-2d-snap';
import type { EditorCabinet } from '../../application/projects/editor-scene';
import type { RoomSelection } from '../viewport/studio-renderer';
import { createTransform, type Point2D, type ViewportTransform } from './studio-2d-canvas';
export type ToolMode = 'select' | 'wall';
interface DragState {
  kind: 'pan' | 'corner' | 'wall' | 'opening' | 'furniture' | 'pinch';
  id?: string | number;
  startScreen: { x: number; y: number };
  startScene: Point2D;
  startTransform: ViewportTransform;
  snapshot: string;
  originalStudio?: Studio;
  origin?: { x: number; y: number; z: number; angle: number };
  moved: boolean;
  guides: readonly { a: Point2D; b: Point2D; label: string }[];
  carry?: import('../../application/commands/studio-commands').Carried;
  initialDist?: number; initialZoom?: number;
}
export interface Studio2DGesturesPorts {
  readonly getStudio: () => Studio | null;
  readonly getWardrobes: () => readonly EditorCabinet[]; readonly getActiveWardrobe: () => number;
  readonly setActiveWardrobe: (id: number) => void;
  readonly getSelection: () => RoomSelection; readonly setSelection: (s: RoomSelection) => void;
  readonly editStudio: (fn: (s: Studio) => Studio | null, record?: boolean, quiet?: boolean) => boolean;
  readonly snapshot: () => string;
  readonly restore: (snapshot: string) => void;
  readonly checkpoint: (snapshot: string) => void;
  readonly committed: () => void;
  readonly refresh: () => void;
  readonly fitScene: () => void;
  readonly previewTranslation: (id: number, pose: { x: number; y: number; z: number }) => boolean;
  readonly settleCabinet: (id: number) => string | null | undefined;
  readonly studioProblem: (studio: Studio, carry?: import('../../application/commands/studio-commands').Carried) => string | null;
  readonly previewStudio: (studio: Studio, carry?: import('../../application/commands/studio-commands').Carried) => void;
  readonly getTransform: () => ViewportTransform;
  readonly setTransform: (updater: (prev: ViewportTransform) => ViewportTransform) => void;
  readonly standingAgainst: (wallId: string) => import('../../application/commands/studio-commands').Carried;
}

export function createStudio2DGestures(ports: Studio2DGesturesPorts) {
  let activeTool: ToolMode = 'select';
  let wallActionTarget: { wallId: string; at: number } | null = null;
  let drag: DragState | null = null;
  let wallDrawStart: Point2D | null = null;
  let wallDrawCurrent: Point2D | null = null;

  const activePointers = new Map<number, { x: number; y: number }>();
  let framePending = false;

  function scheduleRefresh() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      ports.refresh();
    });
  }

  function extendWall(cornerId: string): boolean {
    let addedWall = '';
    cancelDrawing();
    const added = ports.editStudio(studio => {
      const c = studio.corners.find(c => c.id === cornerId);
      const w = studio.walls.find(w => w.a === cornerId || w.b === cornerId);
      const line = w && wallLine(studio, w);
      if (!c || !w || !line || cornerDegree(studio, cornerId) !== 1) return null;
      const sign = w.b === cornerId ? 1 : -1;
      const next = extendFromCorner(studio, cornerId, c.x + line.ux * sign * 150, c.z + line.uz * sign * 150);
      if (next) addedWall = next.walls.at(-1)!.id;
      return next;
    }, true);
    if (added) {
      ports.setSelection({ kind: 'wall', id: addedWall });
      ports.committed();
      ports.fitScene();
    }
    return added;
  }

  function onPointerDown(e: PointerEvent, target: Element): boolean {
    wallActionTarget = null;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-finger pinch on mobile touch screens
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
      finishDrag();
      drag = {
        kind: 'pinch',
        startScreen: mid,
        startScene: { x: 0, z: 0 },
        startTransform: ports.getTransform(),
        snapshot: '',
        moved: true,
        guides: [],
        initialDist: dist,
        initialZoom: ports.getTransform().zoom,
      };
      return true;
    }

    if (activePointers.size > 2) return false;

    const t = ports.getTransform();
    const { toScene } = createTransform(t);
    const rect = target.getBoundingClientRect();
    const scenePt = toScene(e.clientX - rect.left, e.clientY - rect.top);

    const extend = (e.target as Element).closest('[data-extend-id]');
    if (extend) {
      extendWall(extend.getAttribute('data-extend-id')!);
      return true;
    }

    if (activeTool === 'wall') {
      const studio = ports.getStudio();
      let snappedPt = scenePt;
      if (studio) {
        const nearby = studio.corners.map(c => ({ c, d: Math.hypot(c.x - scenePt.x, c.z - scenePt.z) }))
          .filter(h => h.d <= 14 / t.zoom).sort((a, b) => a.d - b.d)[0]?.c;
        const snap = snapCorner(studio, 'temp', scenePt, { x: null, z: null, ray: null, join: null }, 14 / t.zoom, true);
        snappedPt = nearby ? { x: nearby.x, z: nearby.z } : snap.at;
      }
      if (!wallDrawStart) {
        wallDrawStart = snappedPt;
        wallDrawCurrent = snappedPt;
        scheduleRefresh();
        return true;
      }
      const p1 = wallDrawStart, p2 = snappedPt;
      if (Math.hypot(p2.x - p1.x, p2.z - p1.z) > 15 && studio) {
        const added = ports.editStudio(s => {
          const first = attachPlanPoint(s, p1, t.zoom);
          const second = attachPlanPoint(first.room, p2, t.zoom);
          const s1 = second.room, cA = first.corner, cB = second.corner;
          if (cA.id === cB.id) return null;
          const wid = nextId('w', s1.walls);
          const newWall: StudioWall = { id: wid, a: cA.id, b: cB.id, thickness: 12, height: 260 };
          return { ...s1, walls: [...s1.walls, newWall] };
        }, true);
        if (added) { wallDrawStart = p2; wallDrawCurrent = p2; ports.committed(); }
      }
      scheduleRefresh();
      return true;
    }

    const cornerEl = (e.target as Element).closest('[data-corner-id]');
    if (cornerEl) {
      const cornerId = cornerEl.getAttribute('data-corner-id')!;
      const studio = ports.getStudio()!;
      const connWall = studio.walls.find(w => w.a === cornerId || w.b === cornerId);
      if (connWall) ports.setSelection({ kind: 'wall', id: connWall.id });
      drag = {
        kind: 'corner', id: cornerId, startScreen: { x: e.clientX, y: e.clientY },
        startScene: scenePt, startTransform: t, snapshot: ports.snapshot(), originalStudio: studio,
        moved: false, guides: [],
      };
      return true;
    }

    const openingEl = (e.target as Element).closest('[data-opening-id]');
    if (openingEl) {
      const oid = openingEl.getAttribute('data-opening-id')!;
      ports.setSelection({ kind: 'opening', id: oid });
      drag = {
        kind: 'opening', id: oid, startScreen: { x: e.clientX, y: e.clientY },
        startScene: scenePt, startTransform: t, snapshot: ports.snapshot(), originalStudio: ports.getStudio()!,
        moved: false, guides: [],
      };
      scheduleRefresh();
      return true;
    }

    const wallEl = (e.target as Element).closest('[data-wall-id]');
    if (wallEl) {
      const wid = wallEl.getAttribute('data-wall-id')!;
      const studio = ports.getStudio();
      const wall = studio?.walls.find(w => w.id === wid);
      const line = studio && wall && wallLine(studio, wall);
      if (line) {
        wallActionTarget = { wallId: wid, at: Math.max(0, Math.min(line.length,
          (scenePt.x - line.a.x) * line.ux + (scenePt.z - line.a.z) * line.uz)) };
      }
      ports.setSelection({ kind: 'wall', id: wid });
      drag = {
        kind: 'wall', id: wid, startScreen: { x: e.clientX, y: e.clientY },
        startScene: scenePt, startTransform: t, snapshot: ports.snapshot(), originalStudio: ports.getStudio()!,
        moved: false, guides: [], carry: ports.standingAgainst(wid),
      };
      scheduleRefresh();
      return true;
    }

    const fixtureEl = (e.target as Element).closest('[data-fixture-id]');
    if (fixtureEl) {
      ports.setSelection({ kind: 'fixture', id: fixtureEl.getAttribute('data-fixture-id')! });
      scheduleRefresh(); return true;
    }
    const furnEl = (e.target as Element).closest('[data-cabinet-id]');
    if (furnEl) {
      const cabId = Number(furnEl.getAttribute('data-cabinet-id')!);
      const cabinet = ports.getWardrobes().find(c => c.id === cabId);
      if (!cabinet) return false;
      ports.setSelection(null);
      ports.setActiveWardrobe(cabId);
      drag = {
        kind: 'furniture', id: cabId, startScreen: { x: e.clientX, y: e.clientY },
        startScene: scenePt, startTransform: t, snapshot: ports.snapshot(),
        origin: { x: cabinet.x, y: cabinet.y || 0, z: cabinet.z, angle: cabinet.angle }, moved: false, guides: [],
      };
      scheduleRefresh();
      return true;
    }

    ports.setSelection(null);
    drag = {
      kind: 'pan', startScreen: { x: e.clientX, y: e.clientY },
      startScene: scenePt, startTransform: t, snapshot: '', moved: false, guides: [],
    };
    return true;
  }

  function onPointerMove(e: PointerEvent, target: Element): void {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Two-finger pinch-to-zoom on touchscreens
    if (drag && drag.kind === 'pinch' && activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const curDist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      const ratio = curDist / (drag.initialDist || 1);
      const nextZoom = Math.min(6.0, Math.max(0.15, (drag.initialZoom || 0.9) * ratio));
      ports.setTransform(prev => ({ ...prev, zoom: nextZoom }));
      scheduleRefresh();
      return;
    }

    const t = ports.getTransform();
    const { toScene } = createTransform(t);
    const rect = target.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const currentScene = toScene(sx, sy);

    if (activeTool === 'wall' && wallDrawStart) {
      wallDrawCurrent = currentScene;
      scheduleRefresh();
      return;
    }

    if (!drag) return;
    const dxPx = e.clientX - drag.startScreen.x, dyPx = e.clientY - drag.startScreen.y;
    if (Math.hypot(dxPx, dyPx) > 3) drag.moved = true;
    if (!drag.moved) return;
    wallActionTarget = null;

    if (drag.kind === 'pan') {
      ports.setTransform(prev => ({
        ...prev,
        panX: drag!.startTransform.panX - dxPx / prev.zoom,
        panZ: drag!.startTransform.panZ - dyPx / prev.zoom,
      }));
      scheduleRefresh();
      return;
    }

    if (drag.kind === 'furniture') {
      const cabId = Number(drag.id);
      const cab = ports.getWardrobes().find(c => c.id === cabId);
      if (!cab) return;
      const origin = drag.origin!;
      ports.previewTranslation(cabId, { x: origin.x + currentScene.x - drag.startScene.x,
        y: origin.y, z: origin.z + currentScene.z - drag.startScene.z });
      scheduleRefresh();
      return;
    }

    const studio = ports.getStudio();
    if (!studio) return;

    if (drag.kind === 'corner') {
      const cid = String(drag.id);
      const original = drag.originalStudio!;
      const from = original.corners.find(c => c.id === cid);
      if (!from) return;
      const raw = { x: from.x + currentScene.x - drag.startScene.x, z: from.z + currentScene.z - drag.startScene.z };
      const snap = snapPlanCorner(original, cid, raw, t.zoom);
      const accepted = snap.room && !ports.studioProblem(snap.room);
      if (accepted) ports.previewStudio(snap.room!);
      drag.guides = accepted ? snap.guides : [];
      scheduleRefresh();
      return;
    }

    if (drag.kind === 'wall') {
      const wid = String(drag.id);
      const dxScene = currentScene.x - drag.startScene.x;
      const dzScene = currentScene.z - drag.startScene.z;
      const initialStudio = drag.originalStudio!;
      const targetWall = initialStudio.walls.find(x => x.id === wid);
      if (!targetWall) return;
      const line = wallLine(initialStudio, targetWall);
      if (!line) return;
      const proj = dxScene * line.nx + dzScene * line.nz;
      const now = studio.walls.find(w => w.id === wid);
      const currentLine = now && wallLine(studio, now);
      const before = currentLine ? (currentLine.a.x - line.a.x) * line.nx + (currentLine.a.z - line.a.z) * line.nz : 0;
      const result = furthestValid(f => moveWall(initialStudio, wid, before + (proj - before) * f),
        s => !ports.studioProblem(s, drag!.carry));
      if (result.room) ports.previewStudio(result.room, drag.carry);
      scheduleRefresh();
      return;
    }

    if (drag.kind === 'opening') {
      const oid = String(drag.id);
      const targetOpening = studio.openings.find(x => x.id === oid);
      const targetWall = targetOpening && studio.walls.find(x => x.id === targetOpening.wall);
      const line = targetWall && wallLine(studio, targetWall);
      if (!line || !targetOpening) return;
      const relX = currentScene.x - line.a.x, relZ = currentScene.z - line.a.z;
      const nextOffset = Math.max(targetOpening.width / 2 + 5, Math.min(line.length - targetOpening.width / 2 - 5, relX * line.ux + relZ * line.uz));
      ports.editStudio(s => ({
        ...s,
        openings: s.openings.map(o => o.id === oid ? { ...o, offset: Math.round(nextOffset) } : o),
      }), false, true);
      scheduleRefresh();
      return;
    }
  }

  function finishDrag(cancel = false) {
    const finished = drag;
    drag = null;
    if (!finished || !finished.moved || !finished.snapshot) return;
    if (cancel || (finished.kind === 'furniture' && ports.settleCabinet(Number(finished.id)))) {
      ports.restore(finished.snapshot);
    } else if (ports.snapshot() !== finished.snapshot) {
      ports.checkpoint(finished.snapshot);
    }
    ports.committed();
  }

  function onPointerUp(e?: PointerEvent, cancel = false): void {
    if (e) activePointers.delete(e.pointerId);
    else activePointers.clear();
    if (cancel) activePointers.clear();
    if (activePointers.size > 0) return;
    finishDrag(cancel);
    scheduleRefresh();
  }

  function onWheel(e: WheelEvent, target: Element): void {
    e.preventDefault();
    const t = ports.getTransform();
    const rect = target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const nextZoom = Math.min(6.0, Math.max(0.15, t.zoom * factor));
    const { toScene } = createTransform(t);
    const sceneBefore = toScene(mouseX, mouseY);
    const cx = t.width / 2, cz = t.height / 2;
    const nextPanX = sceneBefore.x - (mouseX - cx) / nextZoom;
    const nextPanZ = sceneBefore.z - (mouseY - cz) / nextZoom;
    ports.setTransform(() => ({ ...t, zoom: nextZoom, panX: nextPanX, panZ: nextPanZ }));
    scheduleRefresh();
  }

  function setTool(tool: ToolMode) {
    activeTool = tool;
    wallActionTarget = null;
    wallDrawStart = null;
    wallDrawCurrent = null;
    scheduleRefresh();
  }

  function cancelDrawing() {
    wallDrawStart = null;
    wallDrawCurrent = null;
    setTool('select');
  }

  return {
    onPointerDown, onPointerMove, onPointerUp, onWheel,
    extendWall, setTool, getTool: () => activeTool, cancelDrawing,
    getWallDrawState: () => wallDrawStart && wallDrawCurrent ? { start: wallDrawStart, current: wallDrawCurrent } : null,
    getWallActionTarget: () => wallActionTarget,
    clearWallActionTarget: () => { wallActionTarget = null; scheduleRefresh(); },
    getGuides: () => drag?.guides ?? [],
  };
}
