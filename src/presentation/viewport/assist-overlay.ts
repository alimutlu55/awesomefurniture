import * as THREE from 'three';
import type { Alignment, Gap, GapSide } from '../../domain/studio/scene-gaps';
import { measureAround } from '../../application/commands/align-commands';
import type { EditorCabinet, EditorScene } from '../../application/projects/editor-scene';
import { measureNumber } from '../editor/editor-format.js';

type Lab = { p: THREE.Vector3; el: HTMLElement; owner?: THREE.Object3D };
interface AssistOverlayPorts {
  readonly document: { createElement: Document['createElement'] };
  readonly labels: () => HTMLElement;
  readonly scene: THREE.Scene;
  readonly renderState: { labs: Lab[] };
}
/** A hinged door needs this much room in front to open; less is shown as tight. */
const DOOR_ROOM = 60;
const colour = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();

/** The measuring assistant on the model while something is moved or resized: a dimension line from each
 * face being changed to the nearest surface (wall, neighbour, ceiling) with its distance, green where it
 * lines up (touching, centred, fronts in line, tops level), amber where doors would not open. Nothing else:
 * it replaces what it drew last, and the editor hides other handles while it shows. Scene centimetres. */
export function createAssistOverlay({ document, labels, scene, renderState }: AssistOverlayPorts) {
  const group = new THREE.Group();
  group.name = 'measuring-assistant';
  scene.add(group);
  const material = (hex: string, dashed = false) => dashed
    ? new THREE.LineDashedMaterial({ color: colour(hex), dashSize: 5, gapSize: 4, toneMapped: false, depthTest: false, transparent: true })
    : new THREE.LineBasicMaterial({ color: colour(hex), toneMapped: false, depthTest: false, transparent: true });
  const ink = material('#2f2a22'), ok = material('#2f8a57'), tight = material('#c0782b'), level = material('#2f8a57', true);
  let mine: Lab[] = [];

  function clear() {
    group.children.forEach(o => (o as THREE.LineSegments).geometry.dispose());
    group.clear();
    const set = new Set(mine);
    mine.forEach(l => l.el.remove());
    renderState.labs = renderState.labs.filter(l => !set.has(l));
    mine = [];
  }
  function tag(p: THREE.Vector3, text: string, tone: string) {
    const el = document.createElement('div');
    el.className = 'lbl assist-gap' + (tone ? ' ' + tone : '');
    el.textContent = text;
    labels().appendChild(el);
    const entry = { p, el };
    renderState.labs.push(entry);
    mine.push(entry);
  }
  /** A dimension line with short ticks across its ends. */
  function dimension(a: THREE.Vector3, b: THREE.Vector3, m: THREE.Material) {
    const dir = b.clone().sub(a), vertical = Math.abs(dir.y) > Math.hypot(dir.x, dir.z);
    const tick = vertical ? new THREE.Vector3(5, 0, 0) : new THREE.Vector3(0, 5, 0);
    const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m);
    line.renderOrder = 30;
    group.add(line);
  }

  /** Draws the gaps and alignments given; with nothing, clears. */
  function draw(gaps: readonly Gap[] = [], aligned: readonly Alignment[] = []) {
    clear();
    const green = new Set(aligned.flatMap(a => a.kind === 'centred' || a.kind === 'flush' ? a.sides ?? [] : []));
    for (const g of gaps) {
      const a = new THREE.Vector3(g.from.x, g.from.y, g.from.z), b = new THREE.Vector3(g.to.x, g.to.y, g.to.z);
      const short = g.side === 'front' && g.distance < DOOR_ROOM, good = green.has(g.side);
      if (g.distance >= .5) dimension(a, b, good ? ok : short ? tight : ink);
      // Flush against the wall behind: the green strip at its foot already says so.
      if (g.side === 'back' && g.target === 'wall' && g.distance < .5) continue;
      const text = g.distance < .5 ? 'Flush' : measureNumber(g.distance) + ' cm' + (short ? ' · doors need ' + DOOR_ROOM : '');
      // Near the wardrobe being changed, so a long gap's tag stays in view: half way, or 25 cm out at most.
      const at = a.clone().add(b.clone().sub(a).setLength(Math.min(g.distance / 2, 25)));
      tag(g.distance < .5 ? a : at, text, good || g.distance < .5 ? 'ok' : short ? 'tight' : '');
    }
    if (aligned.some(a => a.kind === 'centred')) {
      const l = gaps.find(g => g.side === 'left'), r = gaps.find(g => g.side === 'right');
      if (l && r) tag(new THREE.Vector3((l.from.x + r.from.x) / 2, l.from.y - 14, (l.from.z + r.from.z) / 2), 'Centred', 'ok note');
    }
    for (const a of aligned) {
      if ((a.kind !== 'fronts' && a.kind !== 'tops') || !a.a || !a.b) continue;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.a.x, a.a.y, a.a.z), new THREE.Vector3(a.b.x, a.b.y, a.b.z)]), level);
      line.computeLineDistances();
      line.renderOrder = 30;
      group.add(line);
      tag(new THREE.Vector3(a.b.x, a.b.y + 6, a.b.z), a.kind === 'fronts' ? 'Fronts in line' : 'Tops level', 'ok note');
    }
  }
  return {
    draw, clear,
    dispose() { clear(); [ink, ok, tight, level].forEach(m => m.dispose()); scene.remove(group); },
  };
}

type Size = 'w' | 'h' | 'd';
/** The sides measured while a size changes, and the alignments that matter for it. */
export const SIZE_SIDES: Record<Size, GapSide[]> = { w: ['left', 'right'], h: ['top'], d: ['front', 'back'] };
const SIZE_ALIGN: Record<Size, Alignment['kind'][]> = { w: ['centred', 'flush'], h: ['tops'], d: ['fronts', 'flush'] };

/** The assistant for the selected wardrobe: measures it in the scene and draws what matters for what is
 * being done (`mode` 'move' or 'size'). While it shows, the label layer is marked so other handles hide. */
export function createWardrobeAssist(ports: AssistOverlayPorts) {
  const overlay = createAssistOverlay(ports);
  function show(scene: EditorScene, cabinet: EditorCabinet | null, sides: GapSide[] | null, mode: 'move' | 'size', editing: Size | false) {
    const host = ports.labels();
    // Clearing leaves the marks of other assistants (a fitting's or a divider's drag) alone.
    if (!sides || !cabinet) { overlay.clear(); if (host && (host.dataset.assist === 'move' || host.dataset.assist === 'size')) delete host.dataset.assist; return; }
    const m = measureAround(scene, cabinet, sides), sideways = sides.includes('left'), keep = mode === 'size' && editing ? SIZE_ALIGN[editing] : null;
    // Moved sideways, the room in front matters only when it is getting tight.
    overlay.draw(m.gaps.filter(g => !(sideways && g.side === 'front' && g.distance > 120)), m.aligned.filter(a => !keep || keep.includes(a.kind)));
    if (host) host.dataset.assist = mode;
  }
  return { show, dispose: overlay.dispose };
}
