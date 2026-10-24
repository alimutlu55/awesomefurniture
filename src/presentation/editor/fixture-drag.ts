import type { createFixtureCommands } from '../../application/commands/fixture-commands';
import type { createEditorModel } from '../../application/projects/editor-model';
import type { FixtureAnchor } from '../../domain/studio/fixtures/fixture';
import { wallFace, wallLine } from '../../domain/studio/studio';
import type { RoomSelection } from '../viewport/studio-renderer';
import { moveFixtureAssembly } from '../../domain/studio/fixtures/fixture-assembly';
import { resolveAlignment, type AlignTarget } from '../../domain/geometry/alignment';
import type { Studio } from '../../domain/studio/studio';
import { fixturePose } from '../../domain/studio/fixtures/fixture-geometry';

interface Ports {
  model: Pick<ReturnType<typeof createEditorModel>, 'scene' | 'snapshot' | 'restore'>;
  commands: ReturnType<typeof createFixtureCommands>;
  selection(): RoomSelection;
  point(e: PointerEvent): { x: number; z: number } | null;
  checkpoint(before: string): void; refresh(): void; redraw(): void;
}
interface Drag {
  id: string; enclosure: boolean; pointer: number; target: HTMLElement; before: string;
  anchor: FixtureAnchor; point: { x: number; z: number }; client: { x: number; y: number }; moved: boolean;
  assembly: boolean;
  original: Studio; applied: FixtureAnchor;
}
export function createFixtureDrag({ model, commands, selection, point, checkpoint, refresh, redraw }: Ports) {
  let drag: Drag | null = null;
  function begin(e: PointerEvent, hit: { object: { userData: Record<string, unknown> } }, target: HTMLElement) {
    const s = selection(), room = model.scene.studio, p = point(e);
    if (!s || !room || !p || e.button > 0 || (s.kind !== 'fixture' && s.kind !== 'enclosure')) return false;
    const item = s.kind === 'fixture' ? room.fixtures?.find(f => f.id === s.id) : room.enclosures?.find(f => f.id === s.id);
    const id = hit.object.userData[s.kind === 'fixture' ? 'studioFixture' : 'studioEnclosure'];
    if (!item || id !== s.id) return false;
    e.preventDefault(); e.stopPropagation();
    drag = { id: s.id, enclosure: s.kind === 'enclosure', pointer: e.pointerId, target, before: model.snapshot(),
      anchor: item.anchor, point: p, client: { x: e.clientX, y: e.clientY }, moved: false, assembly: !!s.assembly, original: room, applied: item.anchor };
    try { target.setPointerCapture(e.pointerId); } catch { /* pointer may have ended before capture */ }
    return true;
  }
  function move(e: PointerEvent) {
    const g = drag, room = model.scene.studio, p = point(e);
    if (!g || !room || !p || e.pointerId !== g.pointer) return;
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < 4) return;
    g.moved = true;
    const selectedItem = g.enclosure ? room.enclosures?.find(f => f.id === g.id) : room.fixtures?.find(f => f.id === g.id);
    if (!selectedItem) return;
    const dx = p.x - g.point.x, dz = p.z - g.point.z, a = g.anchor, unit = e.shiftKey ? .1 : 1;
    const round = (n: number) => Math.round(n / unit) * unit;
    let anchor: FixtureAnchor;
    if (a.kind === 'floor') anchor = { ...a, x: round(a.x + dx), z: round(a.z + dz) };
    else if (a.kind === 'wall') {
      const wall = room.walls.find(w => w.id === a.wall), line = wall && wallLine(room, wall);
      if (!line) return;
      const raw = round(a.offset + dx * line.ux + dz * line.uz), face = wallFace(room, wall!);
      const targets: AlignTarget<number>[] = face ? [{ v: (face.start + face.end) / 2, label: 'Centred on wall' },
        { v: face.start + selectedItem.w / 2, label: 'Wall end' }, { v: face.end - selectedItem.w / 2, label: 'Wall end' }] : [];
      for (const peer of [...room.fixtures ?? [], ...room.enclosures ?? []]) {
        if (peer.id === g.id || peer.anchor.kind !== 'wall' || peer.anchor.wall !== a.wall) continue;
        targets.push({ v: peer.anchor.offset, label: 'Centres aligned' });
        for (const sign of [1, -1]) targets.push({ v: peer.anchor.offset + (peer.w + selectedItem.w) / 2 * sign, label: 'Edges meet' });
      }
      const reachable = targets.filter(t => {
        const nextAnchor = { ...a, offset: t.v };
        const next = g.enclosure ? { ...room, enclosures: room.enclosures!.map(f => f.id === g.id ? { ...f, anchor: nextAnchor } : f) }
          : g.assembly ? moveFixtureAssembly(g.original, g.id, nextAnchor)
            : { ...room, fixtures: room.fixtures!.map(f => f.id === g.id ? { ...f, anchor: nextAnchor } : f) };
        return !!next && !commands.problem(next);
      });
      anchor = { ...a, offset: e.shiftKey ? raw : resolveAlignment(raw, reachable, { tolerance: 2 })?.v ?? raw };
    } else if (a.kind === 'enclosure') {
      const host = room.enclosures?.find(e => e.id === a.enclosure), wa = host?.anchor;
      const wall = wa?.kind === 'wall' && room.walls.find(w => w.id === wa.wall), line = wall && wallLine(room, wall);
      const angle = wa?.kind === 'floor' ? wa.angle * Math.PI / 180 : line ? line.angle * Math.PI / 180 : 0;
      anchor = { ...a, offset: round(a.offset + dx * Math.cos(angle) - dz * Math.sin(angle)) };
    } else {
      const host = room.fixtures?.find(f => f.id === a.fixture), pose = host && fixturePose(room, host), angle = (pose?.angle ?? 0) * Math.PI / 180;
      anchor = { ...a, x: round(a.x + dx * Math.cos(angle) - dz * Math.sin(angle)), z: round(a.z + dx * Math.sin(angle) + dz * Math.cos(angle)) };
    }
    const item = g.enclosure ? room.enclosures?.find(f => f.id === g.id) : room.fixtures?.find(f => f.id === g.id);
    if (!item) return;
    const previous = g.assembly ? g.applied : item.anchor;
    // Check the path at short intervals so the pointer cannot jump through a thin wall or screen.
    const numbers = Object.entries(anchor).filter((entry): entry is [string, number] => typeof entry[1] === 'number');
    const travel = Math.max(0, ...numbers.map(([k, v]) => Math.abs(v - Number((previous as unknown as Record<string, unknown>)[k]))));
    const steps = Math.max(1, Math.ceil(travel / 2));
    let last = room;
    for (let i = 1; i <= steps; i++) {
      const at = { ...anchor } as unknown as Record<string, unknown>;
      for (const [k, v] of numbers) at[k] = Number((previous as unknown as Record<string, unknown>)[k]) + (v - Number((previous as unknown as Record<string, unknown>)[k])) * i / steps;
      const next = g.enclosure ? { ...room, enclosures: room.enclosures!.map(f => f.id === g.id ? { ...f, anchor: at as unknown as typeof f.anchor } : f) }
        : g.assembly ? moveFixtureAssembly(g.original, g.id, at as unknown as FixtureAnchor)
          : { ...room, fixtures: room.fixtures!.map(f => f.id === g.id ? { ...f, anchor: at as unknown as FixtureAnchor } : f) };
      if (!next || commands.problem(next)) break;
      last = next;
      g.applied = at as unknown as FixtureAnchor;
    }
    if (last !== room && commands.commit(last, false, true)) redraw();
  }
  function end(cancel = false) {
    const g = drag;
    if (!g) return false;
    drag = null;
    try { if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer); } catch { /* already released */ }
    if (cancel) model.restore(g.before);
    else if (model.snapshot() !== g.before) checkpoint(g.before);
    refresh(); return g.moved;
  }
  return { begin, move, end, dragging: () => drag !== null };
}
