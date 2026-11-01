import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import type { DrawingInput } from '../../src/domain/drawings/room-pieces';
import { personaBelongings, SPACES, spaceSpec } from '../../src/presentation/experience/spaces';

/** Designs the engineering rule tests share: one wardrobe on its own, the six golden wardrobes as Auto design applies
 * them (golden.test.ts), and every welcome space as the welcome builds it for an everyday person. */

export const alone = (design: EditorDesign): DrawingInput => ({ pieces: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 0, angle: 0, design }] });
export const wardrobe = (over: Partial<EditorDesign>): EditorDesign => ({ ...createInitialDesign(), ...over });

const GOLDEN: Record<string, { template?: 'sloped' | 'stepped'; w?: number; accessible?: boolean; needs?: Record<string, number> }> = {
  'regular-default': {},
  'regular-modest-handbags': { needs: { short: 14, long: 4, pants: 8, folded: 20, shoes: 6, small: 20, handbags: 6 } },
  'regular-accessible': { accessible: true },
  'regular-narrow': { w: 100 },
  'sloped-default': { template: 'sloped' },
  'stepped-default': { template: 'stepped' },
};

export function goldenWardrobes(): [string, EditorDesign][] {
  return Object.entries(GOLDEN).map(([name, c]) => {
    const state = createEditorState();
    if (c.w) state.w = c.w;
    if (c.template) {
      const start = createFromTemplate(c.template, { w: state.w, h: state.h, maxN: 6 });
      Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
    }
    if (c.accessible) Object.assign(state.profile, { accessible: true, reach: 122 });
    if (c.needs) state.profile.needs = { ...state.profile.needs, ...c.needs } as never;
    const commands = createDesignCommands(() => state), best = generateDesignedLayouts(createWardrobeGeometry(() => state).plannerConfig())[0];
    if (best) commands.applyProposal(best as never);
    return [name, state];
  });
}

export function welcomeSpaces(): [string, DrawingInput][] {
  return SPACES.map(s => {
    const built = buildFromSpec(spaceSpec(s, personaBelongings('everyday')), 'welcome-' + s.id);
    if (!built.ok) throw new Error(s.id + ': ' + JSON.stringify(built.problems));
    const scene = projectToScene(built.project)!;
    return [s.name, { studio: scene.studio, pieces: scene.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) }];
  });
}
