import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { decorCatalog, getDecor } from '../../src/domain/materials/decor-catalog';
import { defaultMaterials } from '../../src/domain/materials/configured-materials';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { parseProject, serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { imageDesignSpecification } from '../../src/application/projects/image-design-specification';
import { serializeDecorPromptManifest } from '../../src/application/projects/decor-prompt-manifest';
import { generateDesignImage } from '../../src/infrastructure/gemini/generate-design-image';
import { parseDesignImageRequest } from '../../src/infrastructure/gemini/design-image-contract';
import { createCabinetMaterials } from '../../src/presentation/viewport/cabinet-materials';
import { renderCabinetDoors } from '../../src/presentation/viewport/door-renderer';
import { createFrontParts } from '../../src/presentation/viewport/furniture-parts';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { cabinetBoards } from '../../src/domain/drawings/cabinet-boards';
import { kitchenSpans } from '../../src/domain/kitchen/kitchen-runs';
import { technicalDrawings } from '../../src/domain/drawings/technical-drawings';
import { IMAGE_VIEWS } from '../../src/application/projects/design-image';
import { paginateDrawingSheets } from '../../src/presentation/drawings/table-marks';
import { loadDecorSwatches } from '../../src/presentation/ai/decor-swatch-references';
import { boardUVs } from '../../src/presentation/viewport/board-geometry';

const M = (color: string, options?: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), ...options });
const twoTone = () => ({ ...defaultMaterials(), frontDecorId: 'egger-u702-st9', linkedDecors: false, handleFinish: 'handleless_tip_on' as const });
const baseProject = { schemaVersion: 1 as const, id: 'decor-test', name: 'Decor test', units: 'cm' as const, wardrobes: [] };
const fixture = () => {
  const model = createEditorModel();
  model.activeCabinet().state.materials = twoTone();
  model.activeCabinet().state.doors = 'hinged';
  model.activeCabinet().state.secs[0] = [{ k: 'drawer', h: 22 }];
  return model;
};

test('catalog contains verified distinct brands/structures with explicit stock and PBR values', () => {
  assert.ok(decorCatalog.length >= 10);
  assert.equal(new Set(decorCatalog.map(s => s.id)).size, decorCatalog.length);
  assert.deepEqual(new Set(decorCatalog.map(s => s.manufacturer)), new Set(['Egger', 'Kronospan', 'Swiss Krono']));
  for (const sku of decorCatalog) {
    assert.match(sku.pbr.baseHex, /^#[a-f0-9]{6}$/i);
    assert.ok(sku.pbr.roughness >= 0 && sku.pbr.roughness <= 1);
    assert.equal(sku.pbr.metalness, 0);
    assert.ok(sku.allowedZones.length && sku.edgeBandingSpec && sku.sourceUrl);
  }
  assert.doesNotMatch(getDecor('egger-u702-st9').aiPromptDescriptor, /anti-fingerprint|PerfectSense/);
  assert.match(getDecor('egger-u702-pm').aiPromptDescriptor, /anti-fingerprint.*PerfectSense/);
  assert.equal(getDecor('egger-h1318-st10-worktop-38').thicknessMm, 38);
});

test('commands update linked or contrasting IDs atomically, refresh immediately and preserve selections in validated persistence', () => {
  const model = createEditorModel(); let changed = 0, checkpoints = 0;
  const commands = createDesignCommands(() => model.activeCabinet().state, { changed: () => { changed++; }, checkpoint: () => { checkpoints++; } });
  commands.setDecor('carcass', 'egger-h3170-st12');
  assert.equal(model.activeCabinet().state.materials!.frontDecorId, 'egger-h3170-st12');
  commands.setLinkedDecors(false);
  commands.setDecor('fronts', 'egger-u702-st9'); commands.setHandleFinish('handleless_tip_on'); commands.setAccessoryFinish('matte_black');
  assert.equal(model.activeCabinet().state.materials!.carcassDecorId, 'egger-h3170-st12');
  assert.equal(model.activeCabinet().state.materials!.frontDecorId, 'egger-u702-st9');
  assert.equal(changed, 5); assert.equal(checkpoints, 5);
  const saved = sceneToProject(baseProject, model.scene);
  const restored = projectToScene(deserializeProject(serializeProject(saved)))!;
  assert.deepEqual(restored.wardrobes[0]!.state.materials, model.activeCabinet().state.materials);
  const bad = structuredClone(saved); bad.wardrobes[0]!.materials!.frontDecorId = 'invented-board';
  assert.throws(() => parseProject(bad));
  assert.throws(() => commands.setDecor('carcass', 'egger-h1318-st10-worktop-38'));
  commands.setLinkedDecors(true);
  assert.equal(model.activeCabinet().state.materials!.frontDecorId, 'egger-h3170-st12');
});

test('two-tone viewport uses separate SKU colors and roughness, and removes wardrobe and kitchen pulls in handleless mode', () => {
  const design = createEditorState(); design.materials = twoTone(); design.doors = 'hinged';
  const materials = createCabinetMaterials({ M }, design);
  assert.equal(materials.panel.userData.decorId, 'egger-h1318-st10');
  assert.equal(materials.front.userData.decorId, 'egger-u702-st9');
  assert.notEqual(materials.panel.color.getHex(), materials.front.color.getHex());
  assert.equal(materials.front.roughness, .85); assert.equal(materials.front.map, null);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent?: THREE.Object3D) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); parent?.add(mesh); return mesh;
  };
  const group = new THREE.Group(), geometry = createWardrobeGeometry(() => design);
  const pivots = renderCabinetDoors(design, geometry.widths(), group, box, () => new THREE.Group(), { M }, materials.front, materials.hardware);
  assert.ok(pivots.length);
  for (const pivot of pivots) {
    assert.equal(pivot.children.length, 1, 'only the door panel, no bar pull');
    const panel = pivot.children[0] as THREE.Mesh<THREE.BoxGeometry>;
    assert.equal(panel.material, materials.front); assert.ok(Math.abs(panel.geometry.parameters.depth - 1.8) < .001);
  }
  const fronts = new THREE.Group();
  const parts = createFrontParts({ box, group: fronts, face: 32, depth: 60, front: materials.front, inside: materials.panel, metal: materials.hardware, handleless: true });
  parts.pull(16, 0, 40); assert.equal(fronts.children.length, 0);
  materials.owned.forEach(m => m.dispose());
});

test('final Gemini text and debug log contain exact two-tone SKUs, tactile descriptor, grain and handleless rules; swatches follow geometry', async () => {
  const model = fixture(), specification = imageDesignSpecification(model.scene);
  const input = { specification, references: IMAGE_VIEWS.map(view => ({ view, mimeType: 'image/jpeg' as const, data: '/9j/2Q==',
    width: 1024 as const, height: 768 as const, camera: { position: [0, 180, 600], target: [0, 110, 0], fov: 35 } })),
    decorSwatches: [{ decorId: 'egger-h1318-st10', mimeType: 'image/webp' as const, data: '/9j/2Q==' }] };
  assert.ok(parseDesignImageRequest(JSON.parse(JSON.stringify(input))));
  assert.equal(parseDesignImageRequest({ ...input, decorSwatches: [{ ...input.decorSwatches[0], decorId: 'egger-h3734-st9' }] }), null);
  const logs: string[] = [], oldDebug = console.debug; console.debug = value => logs.push(String(value));
  try {
    await generateDesignImage(input, 'secret-key', new AbortController().signal, async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const final = body.input.at(-1).text;
      assert.match(final, /TIER 1 — LOCKED CUSTOMER BOARD SKUS/);
      assert.match(final, /Carcass, Open Shelves & Exposed Sides: Egger H1318 ST10/);
      assert.match(final, /Closed Doors & Drawer Fronts \(Contrasting Decor\): Egger U702 ST9/);
      assert.ok(final.includes(getDecor('egger-h1318-st10').aiPromptDescriptor));
      assert.match(final, /Grain: vertical/); assert.match(final, /Grain: none/);
      assert.match(final, /2mm shadow gaps \(zero visible handles\)/);
      assert.match(body.input[6].text, /Image 4.*Egger H1318 ST10.*Wing\/module 1: carcass/);
      assert.equal(body.input[7].type, 'image'); assert.equal(body.input.length, 9);
      return Response.json({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'image', mime_type: 'image/jpeg', data: '/9j/2Q==' }] }] });
    }, 'debug');
  } finally { console.debug = oldDebug; }
  assert.match(logs.join(''), /Egger H1318 ST10/); assert.match(logs.join(''), /Egger U702 ST9/); assert.doesNotMatch(logs.join(''), /secret-key/);
  assert.match(serializeDecorPromptManifest(getDecor('egger-u702-pm'), getDecor('egger-u702-pm'), 'brushed_brass', 'Bay 1'), /Unified Decor.*U702 PM/);
});

test('technical/PDF sheet model and cutting list use exact matching boards and manufacture handleless fronts', () => {
  const model = fixture(), piece = model.activeCabinet();
  const sheets = technicalDrawings({ pieces: [{ ...piece, design: piece.state }] });
  const schedule = sheets.find(s => s.title === 'Material & Hardware Schedule')!;
  const rows = schedule.table!.rows;
  assert.ok(rows.some(r => r[1] === 'Carcass Board' && r[2]!.includes('Egger H1318 ST10') && r[3] === '18mm'));
  assert.ok(rows.some(r => r[1] === 'Fronts Board' && r[2]!.includes('Egger U702 ST9') && r[3] === '18mm'));
  assert.ok(paginateDrawingSheets(sheets).some(s => s.table?.rows.some(r => r[2]?.includes('Egger U702 ST9'))));
  const cuts = sheets.filter(s => s.title.startsWith('Cutting list')).flatMap(s => s.table!.rows);
  assert.ok(cuts.some(r => r[1] === 'Drawer front' && r[6]!.includes('Egger U702 ST9')));
  assert.ok(cuts.some(r => r[1] === 'Door' && r[5] === '18' && r[6]!.includes('Egger U702 ST9')));
  const hardware = sheets.find(s => s.title === 'Hardware list')!.table!.rows;
  assert.ok(hardware.some(r => r[0] === 'Push-to-open mechanism')); assert.ok(hardware.every(r => r[0] !== 'Handle'));
});

test('38mm selected kitchen worktop matches run geometry and cutting schedule; different worktops split runs', () => {
  const state = createKitchenDesign('base', 'drawers');
  state.materials = { ...twoTone(), worktopDecorId: 'egger-h1318-st10-worktop-38' };
  const piece = { id: 1, name: 'Kitchen', x: 0, y: 0, z: 0, angle: 0, state };
  const worktop = kitchenSpans([piece]).find(s => s.kind === 'worktop')!;
  assert.equal(worktop.height, 3.8);
  const other = { ...piece, id: 2, x: state.w, state: { ...state, materials: { ...twoTone() } } };
  assert.equal(kitchenSpans([piece, other]).filter(s => s.kind === 'worktop').length, 2);
  const sheets = technicalDrawings({ pieces: [{ ...piece, design: state }] });
  const cut = sheets.filter(s => s.title.startsWith('Cutting list')).flatMap(s => s.table!.rows).find(r => r[1] === 'Worktop')!;
  assert.equal(cut[5], '38'); assert.equal(cut[6], 'Egger H1318 ST10');
  assert.ok(cabinetBoards(state).filter(b => b.stock === 'front').every(b => Math.abs(b.cut.thickness - 1.8) < .001));
});

test('swatch collection deduplicates selected decors and tolerates missing local assets', async () => {
  const spec = imageDesignSpecification(fixture().scene); let calls = 0;
  const swatches = await loadDecorSwatches(spec, new AbortController().signal, async url => {
    calls++; assert.equal(url, '/textures/decors/egger-h1318-st10.webp');
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } });
  });
  assert.equal(calls, 1); assert.deepEqual(swatches, [{ decorId: 'egger-h1318-st10', mimeType: 'image/webp', data: 'AQID' }]);
  assert.deepEqual(await loadDecorSwatches(spec, new AbortController().signal, async () => new Response('', { status: 404 })), []);
});

test('catalog boards retain source tones on every part instead of darkening backs and plinths', () => {
  const materials = createCabinetMaterials({ M }, createEditorState());
  assert.deepEqual(materials.back.color.toArray(), materials.panel.color.toArray());
  assert.deepEqual(materials.plinth.color.toArray(), materials.panel.color.toArray());
  assert.equal(materials.front.toneMapped, false);
  materials.owned.forEach(m => m.dispose());
});

test('upright panels respect the different grain axes of Egger and Swiss Krono source images', () => {
  for (const id of ['egger-h1318-st10', 'swiss-krono-d3025-ow']) {
    const sku = getDecor(id), material = createCabinetMaterials({ M }, { fin: 'Oak', materials: { ...defaultMaterials(), carcassDecorId: id } });
    const geometry = new THREE.PlaneGeometry(60, 120);
    boardUVs(geometry, 0, 'vertical', material.panel.userData.boardMapping);
    const uv = geometry.getAttribute('uv');
    const along = sku.pbr.textureGrainAxis === 'v' ? 'getY' : 'getX', across = along === 'getY' ? 'getX' : 'getY';
    assert.ok(uv[along](0) > uv[along](2), `${id}: source grain follows the panel height`);
    assert.equal(uv[across](0), uv[across](2), `${id}: grain does not rotate across the door`);
    geometry.dispose(); material.owned.forEach(m => m.dispose());
  }
});
