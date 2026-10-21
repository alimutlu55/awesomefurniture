import type { EditorScene } from './editor-scene';
import { sceneToProject } from './editor-mapper';
import { technicalDrawings } from '../../domain/drawings/technical-drawings';
import { FIN, PANEL, PLINTH, MODS } from '../../domain/wardrobe/catalog.js';

/** Full resolved geometry, rather than the smaller intent spec used to create a design. */
export function imageDesignSpecification(scene: EditorScene) {
  const project = sceneToProject({ schemaVersion: 1, id: 'render', name: 'Design', units: 'cm', wardrobes: [] }, scene);
  const input = { studio: scene.studio, pieces: scene.wardrobes.map(({ state, ...piece }) => {
    const { sel: _sel, item: _item, divider: _divider, space: _space, open: _open, ...design } = state;
    return { ...piece, design };
  }) };
  return {
    schemaVersion: 1 as const,
    units: 'cm' as const,
    coordinates: {
      world: 'Right-handed: x right, y up from finished floor, z towards the cabinet front at rotation 0.',
      rotation: 'Degrees about world y; furniture position is its centre in x/z and underside height in y.',
      sections: 'Items and dividers use coordinates from the internal bottom-left of their section.',
      drawings: 'Technical drawing coordinates and dimensions are millimetres; drawing y is elevation or negative world z in plan.',
    },
    construction: { panelThickness: PANEL, wardrobePlinthHeight: PLINTH },
    finishes: Object.fromEntries(Object.entries(FIN).map(([name, values]) => [name, { color: values[0] }])),
    fittings: Object.fromEntries(Object.entries(MODS).map(([key, value]) => [key, { name: value.n, purpose: value.purpose }])),
    design: {
      ...(project.studio ? { studio: project.studio } : {}),
      ...(project.maxReach === undefined ? {} : { maxReach: project.maxReach }),
      furniture: project.wardrobes.map(({ editorLayout: _layout, preferences: _preferences, ...furniture }) => furniture),
    },
    technicalDrawings: technicalDrawings(input, { preset: 'installation' }),
    presentation: {
      doors: 'Closed in reference images; keep the specified door material and geometry.',
      accuracy: 'Preserve the exact furniture count, proportions, placements, roof profiles, openings, sections and fittings.',
      unknowns: 'Unconfirmed appliance and construction information is identified in the technical drawing review issues; do not invent it.',
    },
  };
}
export type ImageDesignSpecification = ReturnType<typeof imageDesignSpecification>;
