import * as THREE from 'three';
import type { resolveHandle } from '../../domain/wardrobe/handles';

/** A bar pull as fitted to wardrobe fronts: a round bar on two short posts that stand it off the front.
 * Centred on the origin with the posts' feet at z = 0, so it is placed on the front's face. Horizontal for
 * drawers, vertical for doors. Centimetres. */
export function barPull(length: number, material: THREE.Material, vertical = false) {
  const group = new THREE.Group(), stand = 2.4, inset = Math.min(1.6, length / 4);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, length, 14), material);
  if (!vertical) bar.rotation.z = Math.PI / 2;
  bar.position.z = stand;
  group.add(bar);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, stand, 8), material), along = side * (length / 2 - inset);
    post.rotation.x = Math.PI / 2;
    post.position.set(vertical ? 0 : along, vertical ? along : 0, stand / 2);
    group.add(post);
  }
  group.traverse(o => { o.castShadow = true; });
  return group;
}

/** The design's handle as the 3D view draws it, centred on the origin on a front's face (z = 0 is the face), upright for
 * a door and level for a drawer: a bar on posts its centre-to-centre apart, a knob, an edge pull or profile standing
 * on the front's edge (placed on the edge, not in from it), or a recessed pull's metal pocket. `run` is the length of
 * the front along the handle. Null when the front takes no handle (push-to-open). Centimetres. */
export function handleMesh(handle: ReturnType<typeof resolveHandle>, run: number, material: THREE.Material, vertical: boolean): THREE.Group | null {
  if (handle.none) return null;
  const { kind, size } = handle, span = size === 'full' ? Math.max(4, run - 10) : size === undefined ? 0 : size / 10;
  const box = (w: number, h: number, d: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.z = z; return m; };
  let group: THREE.Group;
  if (kind.key === 'bar' || kind.key === 'full') group = barPull(span + 3.2, material, true);
  else {
    group = new THREE.Group();
    if (kind.key === 'knob') {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 2, 10), material), head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 10), material);
      post.rotation.x = Math.PI / 2; post.position.z = 1; head.position.z = 2.4; head.scale.z = .7;
      group.add(post, head);
    } else if (kind.key === 'recessed') group.add(box(2.4, span + 2, .1, .05));
    else { const proud = Math.max(.2, kind.projectionMm / 10); group.add(box(.4, kind.key === 'profile' ? run : span + 2, proud, proud / 2)); }
  }
  if (!vertical) group.rotation.z = Math.PI / 2;
  group.traverse(o => { o.castShadow = true; });
  return group;
}
