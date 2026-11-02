import type { Studio, StudioWall } from '../../domain/studio/studio';
import { wallLine } from '../../domain/studio/studio';
import { snapCorner } from './studio-drag';
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
  moved: boolean;
  guides: readonly { a: Point2D; b: Point2D; label: string }[];
  at?: Point2D; carry?: import('../../application/commands/studio-commands').Carried;
  initialDist?: number; initialZoom?: number;
}

export interface Studio2DGesturesPorts {
  readonly getStudio: () => Studio | null;
  readonly getWardrobes: () => readonly EditorCabinet[]; readonly getActiveWardrobe: () => number;
  readonly setActiveWardrobe: (id: number) => void;
  readonly getSelection: () => RoomSelection; readonly setSelection: (s: RoomSelection) => void;
  readonly editStudio: (fn: (s: Studio) => Studio | null, record?: boolean, quiet?: boolean) => boolean;
  readonly checkpoint: () => void; readonly refresh: () => void;
  readonly openFields: (action: string, field: string) => void;
  readonly getTransform: () => ViewportTransform;
  readonly setTransform: (updater: (prev: ViewportTransform) => ViewportTransform) => void;
  readonly standingAgainst: (wallId: string) => import('../../application/commands/studio-commands').Carried;
  readonly carryWardrobes: (carried: import('../../application/commands/studio-commands').Carried, next: Studio) => void;
  readonly wallSnap: (cab: EditorCabinet, pose: { x: number; z: number; angle: number }) => { x: number; z: number; angle: number } | null;
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

  function onPointerDown(e: PointerEvent, target: Element): boolean {
    wallActionTarget = null;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-finger pinch on mobile touch screens
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y);
      const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
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

    if (activeTool === 'wall') {
      ports.checkpoint();
      const studio = ports.getStudio();
      let snappedPt = scenePt;
      if (studio) {
        const snap = snapCorner(studio, 'temp', scenePt, { x: null, z: null, ray: null, join: null }, 18, true);
        snappedPt = snap.at;
      }
      if (!wallDrawStart) {
        wallDrawStart = snappedPt;
        wallDrawCurrent = snappedPt;
        scheduleRefresh();
        return true;
      }
      const p1 = wallDrawStart, p2 = snappedPt;
      if (Math.hypot(p2.x - p1.x, p2.z - p1.z) > 15 && studio) {
        ports.editStudio(s => {
          let s1 = s;
          const hitCorner = (pt: Point2D) => s1.corners.find(c => Math.hypot(c.x - pt.x, c.z - pt.z) < 18);
          let cA = hitCorner(p1), cB = hitCorner(p2);
          if (!cA) {
            const newId = 'c_' + Date.now().toString(36) + 'a';
            s1 = { ...s1, corners: [...s1.corners, { id: newId, x: p1.x, z: p1.z }] };
            cA = s1.corners.find(c => c.id === newId);
          }
          if (!cB) {
            const newId = 'c_' + Date.now().toString(36) + 'b';
            s1 = { ...s1, corners: [...s1.corners, { id: newId, x: p2.x, z: p2.z }] };
            cB = s1.corners.find(c => c.id === newId);
          }
          if (!cA || !cB || cA.id === cB.id) return null;
          const wid = 'w_' + Date.now().toString(36);
          const newWall: StudioWall = { id: wid, a: cA.id, b: cB.id, thickness: 12, height: 260 };
          return { ...s1, walls: [...s1.walls, newWall] };
        }, true);
        wallDrawStart = p2;
        wallDrawCurrent = p2;
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
        startScene: scenePt, startTransform: t, snapshot: JSON.stringify(studio),
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
        startScene: scenePt, startTransform: t, snapshot: JSON.stringify(ports.getStudio()!),
        moved: false, guides: [],
      };
      scheduleRefresh();
      return true;
    }

    const dimEl = (e.target as Element).closest('[data-edit-wall]');
    if (dimEl) {
      const wid = dimEl.getAttribute('data-edit-wall')!;
      ports.setSelection({ kind: 'wall', id: wid });
      ports.openFields('wall-size', 'length');
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
        startScene: scenePt, startTransform: t, snapshot: JSON.stringify(ports.getStudio()!),
        moved: false, guides: [], carry: ports.standingAgainst(wid),
      };
      scheduleRefresh();
      return true;
    }

    const furnEl = (e.target as Element).closest('[data-cabinet-id]');
    if (furnEl) {
      const cabId = Number(furnEl.getAttribute('data-cabinet-id')!);
      ports.setActiveWardrobe(cabId);
      drag = {
        kind: 'furniture', id: cabId, startScreen: { x: e.clientX, y: e.clientY },
        startScene: scenePt, startTransform: t, snapshot: '', moved: false, guides: [],
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

    const studio = ports.getStudio();
    if (!studio) return;

    if (drag.kind === 'corner') {
      const cid = String(drag.id);
      const raw = currentScene;
      const snap = snapCorner(studio, cid, raw, { x: null, z: null, ray: null, join: null }, 12, true);
      drag.guides = snap.guides;
      drag.at = snap.at;
      ports.editStudio(s => {
        const c = s.corners.find(x => x.id === cid);
        if (!c) return null;
        return {
          ...s,
          corners: s.corners.map(x => x.id === cid ? { ...x, x: snap.at.x, z: snap.at.z } : x),
        };
      }, false, true);
      scheduleRefresh();
      return;
    }

    if (drag.kind === 'wall') {
      const wid = String(drag.id);
      const dxScene = currentScene.x - drag.startScene.x;
      const dzScene = currentScene.z - drag.startScene.z;
      const initialStudio: Studio = JSON.parse(drag.snapshot);
      const targetWall = initialStudio.walls.find(x => x.id === wid);
      if (!targetWall) return;
      const line = wallLine(initialStudio, targetWall);
      if (!line) return;
      const proj = dxScene * line.nx + dzScene * line.nz;
      const moveX = line.nx * proj, moveZ = line.nz * proj;
      ports.editStudio(s => {
        const next = {
          ...s,
          corners: s.corners.map(c => {
            if (c.id === targetWall.a || c.id === targetWall.b) {
              const baseC = initialStudio.corners.find(x => x.id === c.id)!;
              return { ...c, x: baseC.x + moveX, z: baseC.z + moveZ };
            }
            return c;
          }),
        };
        if (drag!.carry) ports.carryWardrobes(drag!.carry, next);
        return next;
      }, false, true);
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

    if (drag.kind === 'furniture') {
      const cabId = Number(drag.id);
      const cab = ports.getWardrobes().find(c => c.id === cabId);
      if (!cab) return;
      const rawPose = { x: currentScene.x, z: currentScene.z, angle: cab.angle };
      const snapped = ports.wallSnap(cab, rawPose) ?? rawPose;
      cab.x = snapped.x;
      cab.z = snapped.z;
      cab.angle = snapped.angle;
      scheduleRefresh();
    }
  }

  function onPointerUp(e?: PointerEvent): void {
    if (e) activePointers.delete(e.pointerId);
    else activePointers.clear();

    if (activePointers.size > 0) return;

    if (drag) {
      if (drag.moved && (drag.kind === 'corner' || drag.kind === 'wall' || drag.kind === 'opening')) {
        ports.checkpoint();
      }
      drag = null;
    }
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
    setTool, getTool: () => activeTool, cancelDrawing,
    getWallDrawState: () => wallDrawStart && wallDrawCurrent ? { start: wallDrawStart, current: wallDrawCurrent } : null,
    getWallActionTarget: () => wallActionTarget,
    clearWallActionTarget: () => { wallActionTarget = null; scheduleRefresh(); },
    getGuides: () => drag?.guides ?? [],
  };
}
