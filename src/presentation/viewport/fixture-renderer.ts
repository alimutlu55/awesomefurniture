import * as THREE from 'three';
import type { Studio } from '../../domain/studio/studio';
import { fixturePose, enclosurePose, localPose } from '../../domain/studio/fixtures/fixture-geometry';
import { fixtureDefinition } from '../../domain/studio/fixtures/fixture-catalog';
import type { RoomSelection } from './studio-renderer';
import { drawFixture, fixtureBox } from './fixture-shapes';
import type { StudioFixture, FixtureEnclosure } from '../../domain/studio/fixtures/fixture';

/** Independent room fixtures: their geometry and lifetime never enter the cabinet renderer. */
export function createFixtureViews(scene: THREE.Scene) {
  const root = new THREE.Group(), materials = new Map<string, THREE.MeshStandardMaterial>();
  root.name = 'studio-fixtures'; scene.add(root);
  let key = '', hits: THREE.Object3D[] = [], room: Studio | undefined, selection: RoomSelection = null;
  let outline: THREE.Group | null = null, clearance: THREE.LineLoop | null = null;
  const line = new THREE.LineBasicMaterial({ color: '#647b6b', depthTest: false, transparent: true, opacity: .9 });
  const warningLine = new THREE.LineBasicMaterial({ color: '#ba975b', transparent: true, opacity: .75 });
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const id = color + JSON.stringify(options);
    let m = materials.get(id);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: .8, ...options }); materials.set(id, m); }
    return m;
  };
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  function clear() {
    root.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose(); });
    root.clear(); hits = []; outline = null; clearance = null;
  }
  function sync(s: Studio | undefined) {
    const next = JSON.stringify([s?.fixtures, s?.enclosures, s?.walls, s?.corners]);
    if (next === key) return;
    key = next; clear(); room = s;
    if (!s) return;
    for (const e of s.enclosures ?? []) {
      const p = enclosurePose(s, e);
      if (!p) continue;
      const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.angle * Math.PI / 180;
      const front = material(e.color), side = material(e.sideColor), top = material(e.topColor);
      const body = new THREE.Mesh(new THREE.BoxGeometry(e.w, e.h, e.d), [side, side, top, side, front, side]);
      body.position.y = e.h / 2; body.castShadow = body.receiveShadow = true; body.userData.studioEnclosure = e.id;
      g.add(body); hits.push(body); root.add(g);
      if (e.finish === 'tile') {
        const grout = material('#c0bbb0');
        for (let x = -e.w / 2 + 30; x < e.w / 2; x += 30) fixtureBox(g, .15, e.h, .15, x, e.h / 2, e.d / 2 + .1, grout);
        for (let y = 30; y < e.h; y += 30) fixtureBox(g, e.w, .15, .15, 0, y, e.d / 2 + .1, grout);
      }
    }
    for (const f of s.fixtures ?? []) {
      const p = fixturePose(s, f);
      if (!p) continue;
      const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.angle * Math.PI / 180;
      drawFixture(f, { group: g, material });
      g.traverse(o => { if (o instanceof THREE.Mesh) { o.userData.studioFixture = f.id; hits.push(o); } });
      // A transparent glass panel or a thin rail still has an accessible picking volume.
      const hit = fixtureBox(g, Math.max(f.w, 6), Math.max(f.h, 6), Math.max(f.d, 3), 0, Math.max(f.h, 6) / 2, 0, hitMaterial);
      hit.userData.studioFixture = f.id; hits.push(hit); root.add(g);
      if (f.kind === 'toilet' && f.installation) {
        const plate = new THREE.Group(); plate.position.set(p.x, 100, p.z); plate.rotation.y = p.angle * Math.PI / 180;
        const anchor = f.anchor, e = anchor.kind === 'enclosure' ? s.enclosures?.find(e => e.id === anchor.enclosure) : undefined;
        const ep = e && enclosurePose(s, e), topAccess = f.installation.access === 'top' && e && ep && anchor.kind === 'enclosure';
        if (topAccess) {
          const at = localPose(ep, anchor.offset, e.h + .7, 0);
          plate.position.set(at.x, at.y, at.z); plate.rotation.x = -Math.PI / 2;
        }
        const m = material('#b9bec2', { metalness: .8, roughness: .25 });
        const z = topAccess ? 0 : -f.d / 2 + .7;
        const a = fixtureBox(plate, 22, 14, 1, 0, 0, z, m); a.userData.studioFixture = f.id; hits.push(a);
        fixtureBox(plate, 7, 7, 1, -4, 0, z + .7, material('#d6d9db'));
        fixtureBox(plate, 5, 5, 1, 5, 0, z + .7, material('#d6d9db')); root.add(plate);
      }
    }
    select(selection);
  }
  function select(s: RoomSelection) {
    selection = s;
    for (const item of [outline, clearance]) if (item) {
      item.parent?.remove(item); item.traverse(o => { if (o instanceof THREE.Line) o.geometry.dispose(); });
    }
    outline = null; clearance = null;
    if (!room || !s) return;
    const f = s.kind === 'fixture' ? room.fixtures?.find(f => f.id === s.id) : s.kind === 'enclosure' ? room.enclosures?.find(e => e.id === s.id) : undefined;
    const p = f && (s.kind === 'fixture' ? fixturePose(room, f as NonNullable<Studio['fixtures']>[number]) : enclosurePose(room, f as NonNullable<Studio['enclosures']>[number]));
    if (!f || !p) return;
    outline = new THREE.Group();
    const chosen: (StudioFixture | FixtureEnclosure)[] = s.assembly && 'kind' in f && f.assembly ? room.fixtures!.filter(x => x.assembly === f.assembly) : [f];
    if (s.assembly) for (const member of [...chosen]) {
      if (!('kind' in member) || member.anchor.kind !== 'enclosure') continue;
      const a = member.anchor, e = room.enclosures?.find(e => e.id === a.enclosure);
      const shared = room.fixtures!.some(x => !chosen.some(c => c.id === x.id) && x.anchor.kind === 'enclosure' && x.anchor.enclosure === a.enclosure);
      if (e && !shared && !chosen.includes(e)) chosen.push(e);
    }
    for (const item of chosen) {
      const at = 'kind' in item ? fixturePose(room, item) : enclosurePose(room, item);
      if (!at) continue;
      const box = new THREE.BoxGeometry(item.w + 1, item.h + 1, item.d + 1).translate(0, item.h / 2, 0);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), line); box.dispose();
      edges.position.set(at.x, at.y, at.z); edges.rotation.y = at.angle * Math.PI / 180; edges.renderOrder = 15; outline.add(edges);
    }
    root.add(outline);
    const def = s.kind === 'fixture' ? fixtureDefinition((f as NonNullable<Studio['fixtures']>[number]).kind) : undefined;
    if (def?.clearance) {
      const points = [[-f.w / 2, f.d / 2], [f.w / 2, f.d / 2], [f.w / 2, f.d / 2 + def.clearance], [-f.w / 2, f.d / 2 + def.clearance]];
      clearance = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => {
        const q = localPose(p, x!, -p.y + .5, z!); return new THREE.Vector3(q.x, q.y, q.z);
      })), warningLine); root.add(clearance);
    }
  }
  return { sync, select, pickables: () => hits, dispose() { clear(); scene.remove(root); line.dispose(); warningLine.dispose(); hitMaterial.dispose(); materials.forEach(m => m.dispose()); } };
}
