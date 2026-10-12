import * as THREE from 'three';

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
