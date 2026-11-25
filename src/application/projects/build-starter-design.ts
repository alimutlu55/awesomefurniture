import { createProject } from '../../domain/project/project';
import type { StarterDesign } from '../../domain/project/starter-design';
import { DESIGN_SPEC_VERSION } from '../../domain/spec/design-spec';
import { createSceneCommands } from '../commands/scene-commands';
import { buildFromSpec } from '../spec/build-from-spec';
import { sceneToProject, startingScene } from './editor-mapper';
import { piecePreset, presetSize } from '../../domain/furniture/piece-presets';

export function buildStarterDesign(starter: StarterDesign, id: string) {
  if (starter.kind === 'wardrobe') {
    const result = buildFromSpec({
      specVersion: DESIGN_SPEC_VERSION, name: 'My wardrobe',
      wardrobes: [{ width: starter.width, shape: starter.shape }],
    }, id);
    return result.ok ? result.project : null;
  }
  const scene = startingScene();
  if (starter.kind === 'piece') {
    const piece = createSceneCommands(() => scene).addCabinet(false, 'regular', undefined, presetSize(starter.preset));
    return piece ? sceneToProject(createProject(id, 'My ' + (piecePreset(starter.preset)?.name ?? 'piece').toLowerCase()), scene) : null;
  }
  const cabinet = createSceneCommands(() => scene).addKitchenUnit('base');
  return cabinet ? sceneToProject(createProject(id, 'My kitchen'), scene) : null;
}
