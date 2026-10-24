import * as THREE from 'three';
import type { StudioFixture } from '../../domain/studio/fixtures/fixture';
import { fixtureDefinition } from '../../domain/studio/fixtures/fixture-catalog';

export interface FixtureDrawing {
  readonly group: THREE.Group;
  readonly material: (color: string, options?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
}
export function fixtureBox(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function cylinder(g: THREE.Group, r: number, h: number, x: number, y: number, z: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh;
}
function pipe(g: THREE.Group, a: number[], b: number[], radius: number, m: THREE.Material) {
  const from = new THREE.Vector3(...a as [number, number, number]), to = new THREE.Vector3(...b as [number, number, number]);
  const mesh = cylinder(g, radius, from.distanceTo(to), 0, 0, 0, m);
  mesh.position.copy(from.clone().add(to).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
}
/** A hollow ceramic vessel: the inside and outside have distinct profiles, not a solid ellipsoid. */
function vessel(g: THREE.Group, w: number, h: number, d: number, y: number, z: number, m: THREE.Material) {
  const profile = [[.3, 0], [.5, .05], [.74, .3], [.95, .8], [1, .97], [.98, 1], [.88, 1], [.86, .85], [.65, .35], [.3, .18], [.08, .18]];
  const geometry = new THREE.LatheGeometry(profile.map(([r, v]) => new THREE.Vector2(r!, v! * h)), 40);
  geometry.scale(w / 2, 1, d / 2);
  const mesh = new THREE.Mesh(geometry, m); mesh.position.set(0, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
}
function ring(g: THREE.Group, w: number, d: number, y: number, z: number, m: THREE.Material) {
  const shape = new THREE.Shape(); shape.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(); hole.absellipse(0, 0, w * .35, d * .35, 0, Math.PI * 2, true, 0); shape.holes.push(hole);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: true, bevelSize: .5, bevelThickness: .5, bevelSegments: 2 }).rotateX(-Math.PI / 2), m);
  mesh.position.set(0, y, z); mesh.castShadow = true; g.add(mesh);
}

export function drawFixture(f: StudioFixture, { group: g, material: M }: FixtureDrawing) {
  const shape = fixtureDefinition(f.kind)!.shape, { w, h, d } = f;
  const body = M(f.color, { roughness: .24, envMapIntensity: .8 }), metal = M('#b9bec2', { metalness: .85, roughness: .24 });
  const dark = M('#3b4448', { roughness: .5 }), white = M('#f7f5ef', { roughness: .3 });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m = body) => fixtureBox(g, w, h, d, x, y, z, m);
  if (shape === 'toilet') {
    const close = f.variant === 'close-coupled', bowlH = close ? Math.min(40, h * .54) : h, bowlD = close ? d * .73 : d;
    const z = close ? d * .12 : 0;
    if (f.variant !== 'wall-hung') {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), body);
      foot.scale.set(w * .34, bowlH * .43, bowlD * .35); foot.position.set(0, bowlH * .43, z - 2); g.add(foot); foot.castShadow = true;
    }
    vessel(g, w, bowlH * .7, bowlD, bowlH * .25, z, body);
    ring(g, w, bowlD, Math.max(1, bowlH - 2), z, white);
    if (close) { box(w * .92, h - bowlH, d * .24, 0, (h + bowlH) / 2, -d * .38); box(8, 1, 4, 0, h + .4, -d * .38, metal); }
    else box(w * .65, bowlH * .8, Math.min(8, d * .2), 0, bowlH * .5, -d / 2 + 4);
  } else if (shape === 'basin') {
    const pedestal = f.variant === 'pedestal', bowlH = pedestal ? Math.min(18, h * .25) : h;
    if (pedestal) { const stem = cylinder(g, w * .16, h - bowlH, 0, (h - bowlH) / 2, -d * .12, body); stem.scale.z = .7; }
    vessel(g, w, bowlH, d, h - bowlH, 0, body);
    cylinder(g, Math.min(2.5, w * .06), .5, 0, h - bowlH * .8 + .5, 0, metal);
  } else if (shape === 'faucet') {
    const m = M(f.color, { metalness: .82, roughness: .23 });
    if (f.variant === 'wall') {
      box(w, h, 1, 0, h / 2, -d / 2 + .5, m);
      pipe(g, [0, h * .55, -d / 2], [0, h * .55, d / 2], 1.2, m);
      pipe(g, [0, h * .55, d / 2], [0, h * .2, d / 2], 1.2, m);
    } else {
      cylinder(g, w * .5, h * .88, 0, h * .44, -d / 2 + w / 2, m);
      pipe(g, [0, h * .85, -d / 2 + w / 2], [0, h * .85, d / 2], Math.min(1.3, w * .25), m);
      box(w * .7, 1.5, 7, 0, h - .75, -d / 2 + w / 2, m);
    }
  } else if (shape === 'vanity') {
    const wood = M(f.color, { roughness: .7 }); box(w, h, d, 0, h / 2, 0, wood);
    box(w + .6, 2, d + .6, 0, h - 1, 0, white);
    for (const yy of [h * .25, h * .72]) { box(w - 3, 1, 1, 0, yy, d / 2 + .2, dark); }
    box(w - 2, .25, .3, 0, h / 2, d / 2 + .2, dark);
  } else if (shape === 'mirror') {
    const mirror = M(f.color, { metalness: .92, roughness: .08, envMapIntensity: 1.4 });
    if (f.variant === 'round') {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, d, 48).rotateX(Math.PI / 2), mirror);
      mesh.scale.set(w / 2, h / 2, 1); mesh.position.y = h / 2; g.add(mesh);
    } else box(w, h, d, 0, h / 2, 0, mirror);
  } else if (shape === 'tray') {
    box(w, h, d, 0, h / 2, 0); box(w - 6, .2, d - 6, 0, h + .12, 0, M('#deded6', { roughness: .65 }));
    box(w * .3, .3, 2, 0, h + .3, -d * .32, metal);
  } else if (shape === 'screen') {
    const glass = M(f.color, { transparent: true, opacity: .24, roughness: .08, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
    const mesh = box(w, h, d, 0, h / 2, 0, glass); mesh.castShadow = false;
    box(1.5, h, d + .5, -w / 2, h / 2, 0, metal); box(w, 1.5, d + .5, 0, h, 0, metal);
    if (f.variant !== 'fixed') box(1.5, 22, 3, f.variant === 'hinged-left' ? w / 2 - 6 : -w / 2 + 6, h * .5, 1, metal);
  } else if (shape === 'shower') {
    const m = M(f.color, { metalness: .85, roughness: .22 }), back = -d / 2 + 3;
    box(w, 5, 6, 0, 3, back, m);
    if (f.variant === 'exposed') pipe(g, [0, 5, back], [0, h - 3, back], 1.3, m);
    pipe(g, [0, h - 3, back], [0, h - 3, d / 2 - w / 2], 1.3, m);
    box(w, 2, Math.min(w, d * .6), 0, h - 4, d / 2 - Math.min(w, d * .6) / 2, m);
    pipe(g, [w * .28, 10, back], [w * .28, h * .6, back + 2], .8, m);
  } else if (shape === 'bath') {
    if (f.variant === 'built-in') box(w, h - 3, d, 0, (h - 3) / 2, 0, M('#e2d9cc'));
    vessel(g, w, h, d, 0, 0, body);
  } else if (shape === 'rail') {
    pipe(g, [-w / 2, h / 2, d / 2], [w / 2, h / 2, d / 2], Math.min(1.2, h / 3), body);
    for (const x of [-w / 2, w / 2]) pipe(g, [x, h / 2, -d / 2], [x, h / 2, d / 2], 1.2, body);
  } else if (shape === 'laundry') {
    box(w, h, d, 0, h / 2, 0); box(w - 4, 10, 1, 0, h - 8, d / 2 + .3, white);
    const door = cylinder(g, Math.min(w * .32, h * .25), 2, 0, h * .44, d / 2 + 1, dark); door.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w * .32, h * .25), 1.7, 8, 32), metal);
    rim.position.set(0, h * .44, d / 2 + 2); g.add(rim);
    const knob = cylinder(g, 3, 1.5, w * .25, h - 8, d / 2 + 1, metal); knob.rotation.x = Math.PI / 2;
  } else if (shape === 'radiator') {
    for (const x of [-w / 2 + 2, w / 2 - 2]) cylinder(g, 2, h, x, h / 2, 0, body);
    for (let y = 8; y < h; y += 10) pipe(g, [-w / 2, y, 0], [w / 2, y, 0], 1.3, body);
  }
}
