import test from 'node:test';
import assert from 'node:assert/strict';
import { installationDrawingFixture } from '../../scripts/installation-drawing-fixture.mjs';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { planDimensions } from '../../src/domain/drawings/plan-dimensions';
import type { EditorScene } from '../../src/application/projects/editor-scene';

test('a ceiling-height separator retains its upper chain thickness when it projects beyond the fronts', () => {
  const scene = installationDrawingFixture() as EditorScene;
  const chains = () => {
    const pieces = placePieces({ studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) });
    return planDimensions(scene.studio!, pieces.filter(p => p.y < 120), pieces, false, false)
      .filter(p => p.kind === 'dims' && p.side === 1).map(p => p.kind === 'dims' ? p.stops : []);
  };
  const before = chains();
  const panel = scene.wardrobes.find(p => p.state.unit === 'end-panel' && p.y === 150)!;
  panel.y = 88; panel.state.h = 183.2; panel.state.d = 59.8; panel.z += 12.4;
  assert.deepEqual(chains(), before, 'panel depth and lower starting height must not erase its 18 mm width stop');
});
