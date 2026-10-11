import type { createEditorDom } from './editor-dom';
import type { createEditorModel } from '../../application/projects/editor-model';
import type { createSceneCommands } from '../../application/commands/scene-commands';
import type { createScenePicking } from './scene-picking';
import type { createEditorLifetime } from '../viewport/editor-lifetime';
import type { createCabinetRenderer } from '../viewport/cabinet-renderer';
export interface StudioEditorPorts {
  dom: ReturnType<typeof createEditorDom>;
  model: ReturnType<typeof createEditorModel>;
  sceneCommands: Pick<ReturnType<typeof createSceneCommands>, 'editStudio' | 'studioEditProblem'>;
  picking: ReturnType<typeof createScenePicking>;
  lifetime: ReturnType<typeof createEditorLifetime>;
  rendering: Pick<ReturnType<typeof createCabinetRenderer>, 'build' | 'rulerScreenPlacement'>;
  callbacks: { refresh(): void; frameRoom(plan?: boolean): void; enter(): void };
}
