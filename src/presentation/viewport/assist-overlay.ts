import * as THREE from 'three';
import type { Alignment, Gap, GapSide } from '../../domain/studio/scene-gaps';
import { measureAround } from '../../application/commands/align-commands';
import type { EditorCabinet, EditorScene } from '../../application/projects/editor-scene';
import { measureNumber, unitSuffix } from '../editor/editor-format.js';

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
 * face being changed to the nearest surface (wall, neighbour, ceiling) with its distance. Numbers only, no
 * words: aligned gaps have no tags (a green bar where it touches, a green dashed line along
 * fronts in line or tops level), amber where doors would not open. It replaces what it drew last, and the
 * editor hides other handles while it shows. Scene centimetres. */
export function createAssistOverlay({ document, labels, scene, renderState }: AssistOverlayPorts) {
  const group = new THREE.Group();
  group.name = 'measuring-assistant';
  scene.add(group);
  const material = (hex: string, dashed = false) => dashed
    ? new THREE.LineDashedMaterial({ color: colour(hex), dashSize: 5, gapSize: 4, toneMapped: false, depthTest: false, transparent: true })
    : new THREE.LineBasicMaterial({ color: colour(hex), toneMapped: false, depthTest: false, transparent: true });
  const ink = material('#2f2a22'), ok = material('#2f8a57'), tight = material('#c0782b'), level = material('#2f8a57', true);
  const tagPool: Lab[] = [];
  let activeTags = 0;
  const linePool: THREE.LineSegments[] = [];
  let activeLines = 0;
  const alignLinePool: THREE.Line[] = [];
  let activeAlignLines = 0;

  function clear() {
    for (let i = 0; i < tagPool.length; i++) tagPool[i]!.el.style.display = 'none';
    for (let i = 0; i < linePool.length; i++) linePool[i]!.visible = false;
    for (let i = 0; i < alignLinePool.length; i++) alignLinePool[i]!.visible = false;
    activeTags = 0;
    activeLines = 0;
    activeAlignLines = 0;
  }
  function tag(p: THREE.Vector3, text: string, tone: string) {
    let entry: Lab;
    if (activeTags < tagPool.length) {
      entry = tagPool[activeTags]!;
      entry.p.copy(p);
      const cls = 'lbl assist-gap' + (tone ? ' ' + tone : '');
      if (entry.el.className !== cls) entry.el.className = cls;
      if (entry.el.textContent !== text) entry.el.textContent = text;
      entry.el.style.display = 'block';
    } else {
      const el = document.createElement('div');
      el.className = 'lbl assist-gap' + (tone ? ' ' + tone : '');
      el.textContent = text;
      labels().appendChild(el);
      entry = { p: p.clone(), el };
      renderState.labs.push(entry);
      tagPool.push(entry);
    }
    activeTags++;
  }
  /** A dimension line with short ticks across its ends. */
  function dimension(a: THREE.Vector3, b: THREE.Vector3, m: THREE.Material, angle = 0) {
    const dir = b.clone().sub(a), vertical = Math.abs(dir.y) > Math.hypot(dir.x, dir.z), rad = angle * Math.PI / 180;
    const tick = vertical ? new THREE.Vector3(Math.cos(rad) * 5, 0, -Math.sin(rad) * 5) : new THREE.Vector3(0, 5, 0);
    const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
    if (activeLines < linePool.length) {
      const line = linePool[activeLines]!;
      line.geometry.setFromPoints(pts);
      line.material = m;
      line.visible = true;
    } else {
      const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m);
      line.renderOrder = 30;
      group.add(line);
      linePool.push(line);
    }
    activeLines++;
  }

  /** Draws the gaps and alignments given; with nothing, clears. */
  function draw(gaps: readonly Gap[] = [], aligned: readonly Alignment[] = [], angle = 0) {
    activeTags = 0;
    activeLines = 0;
    activeAlignLines = 0;
    const green = new Set(aligned.flatMap(a => a.kind === 'centred' || a.kind === 'flush' ? a.sides ?? [] : []));
    const rad = angle * Math.PI / 180, alongBar = new THREE.Vector3(Math.cos(rad) * 25, 0, -Math.sin(rad) * 25);
    for (const g of gaps) {
      const a = new THREE.Vector3(g.from.x, g.from.y, g.from.z), b = new THREE.Vector3(g.to.x, g.to.y, g.to.z);
      const short = g.side === 'front' && g.distance < DOOR_ROOM, good = green.has(g.side);
      if (g.distance < .5) {
        // Touching: a short green bar on the face where it meets (the wall strip says so at the back).
        if (g.side === 'left' || g.side === 'right') dimension(a.clone().add(new THREE.Vector3(0, 25, 0)), a.clone().sub(new THREE.Vector3(0, 25, 0)), ok, angle);
        else if (g.side === 'top' || g.side === 'bottom') dimension(a.clone().add(alongBar), a.clone().sub(alongBar), ok, angle);
        continue;
      }
      dimension(a, b, good ? ok : short ? tight : ink, angle);
      // Near the wardrobe being changed, so a long gap's tag stays in view: half way, or 25 cm out at most.
      if (!good) tag(a.clone().add(b.clone().sub(a).setLength(Math.min(g.distance / 2, 25))), measureNumber(g.distance) + unitSuffix(), short ? 'tight' : '');
    }
    // Fronts in line, tops level: a green dashed line along them, no words.
    for (const a of aligned) {
      if ((a.kind !== 'fronts' && a.kind !== 'tops') || !a.a || !a.b) continue;
      const pts = [new THREE.Vector3(a.a.x, a.a.y, a.a.z), new THREE.Vector3(a.b.x, a.b.y, a.b.z)];
      if (activeAlignLines < alignLinePool.length) {
        const line = alignLinePool[activeAlignLines]!;
        line.geometry.setFromPoints(pts);
        line.computeLineDistances();
        line.visible = true;
      } else {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), level);
        line.computeLineDistances();
        line.renderOrder = 30;
        group.add(line);
        alignLinePool.push(line);
      }
      activeAlignLines++;
    }
    for (let i = activeTags; i < tagPool.length; i++) tagPool[i]!.el.style.display = 'none';
    for (let i = activeLines; i < linePool.length; i++) linePool[i]!.visible = false;
    for (let i = activeAlignLines; i < alignLinePool.length; i++) alignLinePool[i]!.visible = false;
  }
  return {
    draw, clear,
    dispose() {
      clear();
      tagPool.forEach(l => l.el.remove());
      const set = new Set(tagPool);
      renderState.labs = renderState.labs.filter(l => !set.has(l));
      tagPool.length = 0;
      linePool.forEach(l => (l as THREE.LineSegments).geometry.dispose());
      alignLinePool.forEach(l => (l as THREE.Line).geometry.dispose());
      [ink, ok, tight, level].forEach(m => m.dispose());
      scene.remove(group);
    },
  };
}

type Size = 'w' | 'h' | 'd' | 'y';
/** The sides measured while a size changes, and the alignments that matter for it. */
export const SIZE_SIDES: Record<Size, GapSide[]> = { w: ['left', 'right'], h: ['top', 'bottom'], d: ['front', 'back'], y: ['top', 'bottom'] };
const SIZE_ALIGN: Record<Size, Alignment['kind'][]> = { w: ['centred', 'flush'], h: ['tops', 'flush'], d: ['fronts', 'flush'], y: ['tops', 'centred', 'flush'] };

/** The assistant for the selected wardrobe: measures it in the scene and draws what matters for what is
 * being done (`mode` 'move' or 'size'). While it shows, the label layer is marked so other handles hide. */
export function createWardrobeAssist(ports: AssistOverlayPorts) {
  const overlay = createAssistOverlay(ports);
  function show(scene: EditorScene, cabinet: EditorCabinet | null, sides: GapSide[] | null, mode: 'move' | 'size', editing: Size | false) {
    const host = ports.labels();
    // Clearing leaves the marks of other assistants (a fitting's or a divider's drag) alone.
    if (!sides || !cabinet) { overlay.clear(); if (host && (host.dataset.assist === 'move' || host.dataset.assist === 'size')) delete host.dataset.assist; return; }
    const m = measureAround(scene, cabinet, sides, { wallEnds: true }), sideways = sides.includes('left'), keep = mode === 'size' && editing ? SIZE_ALIGN[editing] : null;
    // Moved sideways, the room in front matters only when it is getting tight.
    overlay.draw(m.gaps.filter(g => !(sideways && g.side === 'front' && g.distance > 120)), m.aligned.filter(a => !keep || keep.includes(a.kind)), cabinet.angle);
    if (host) host.dataset.assist = mode;
  }
  return { show, dispose: overlay.dispose };
}
