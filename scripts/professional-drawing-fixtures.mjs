import { rectangleStudio } from '../src/domain/studio/studio-templates.ts';
import { createKitchenDesign } from '../src/domain/kitchen/kitchen-design.ts';
export function drawingFixture(kind = 'l') {
  const room = rectangleStudio(420, 340, 300), studio = { ...room, walls: kind === 'l' ? room.walls.filter(w => w.id === 'w1' || w.id === 'w4') : room.walls,
    openings: [{ id: 'water', wall: 'w1', kind: 'water', offset: 110, width: 24, height: 20, sill: 48 }] };
  const wardrobes = [];
  const add = (unit, preset, x, z, angle = 0, y = 0) => wardrobes.push({ id: wardrobes.length + 1, name: preset ?? unit, x, z, angle, y,
    state: { ...createKitchenDesign(unit, preset), sel: 0, item: -1, divider: -1, space: null, open: false } });
  for (let i = 0; i < 6; i++) {
    add(i > 3 ? 'tall' : 'base', i > 3 ? 'fridge' : i === 0 ? 'fridge-under' : 'drawers', -160 + 60 * i, 29);
    add('upper', undefined, -160 + 60 * i, 17.5, 0, i > 3 ? 215 : 142 + (i === 1 ? .1 : 0));
  }
  for (let i = 0; i < 3; i++) { add('base', 'drawers', -181, 100 + i * 60, 90); add('upper', undefined, -192.5, 100 + i * 60, 90, 142); }
  add('sink-top', 'sink-top', -100, 29, 0, 90);
  if (kind === 'shelf') {
    for (let i = wardrobes.length - 1; i >= 0; i--)
      if (wardrobes[i].angle === 90 && wardrobes[i].state.unit === 'upper') wardrobes.splice(i, 1);
    add('shelf', undefined, -192, 181.5, 90, 153);
    const shelf = wardrobes.at(-1); shelf.id = 32; shelf.state.w = 293; shelf.state.h = 3; shelf.state.d = 30;
  }
  if (kind === 'u') for (let i = 0; i < 3; i++) add('base', 'drawers', 181, 110 + i * 60, 270);
  if (kind === 'island') { add('base', 'dishwasher', -100, 150, 180); add('base', 'drawers', -40, 150, 180); }
  if (kind === 'rotated') {
    const a = 37 * Math.PI / 180, rotate = (x, z) => ({ x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) });
    studio.corners = studio.corners.map(c => ({ ...c, ...rotate(c.x, c.z) }));
    wardrobes.forEach(p => Object.assign(p, rotate(p.x, p.z), { angle: p.angle + 37 }));
  }
  return { studio, wardrobes, activeWardrobe: 1, nextWardrobeId: Math.max(...wardrobes.map(p => p.id)) + 1 };
}
export const drawingInput = scene => ({ studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) });
