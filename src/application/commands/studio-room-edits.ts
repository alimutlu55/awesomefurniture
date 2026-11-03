import type { EditorScene } from '../projects/editor-scene';
import type { createStudioCommands } from './studio-commands';
import type { createCeilingCommands } from './ceiling-commands';
import { sameStudioStructure } from '../../domain/studio/studio-paint';

type Edits = Pick<ReturnType<typeof createStudioCommands>, 'editStudio' | 'resizeWallLength' | 'addStudioRoom'>;
type Ceilings = Pick<ReturnType<typeof createCeilingCommands>, 'followAll'>;

/** Direct room edits and smart length edits share the ceiling-following and preview lifecycle. */
export function createStudioRoomEdits(getScene: () => EditorScene, studio: Edits, ceilings: Ceilings) {
  const apply = (write: () => boolean, recordHistory: boolean) => {
    const before = getScene().studio, ok = write();
    if (ok && !sameStudioStructure(before, getScene().studio)) ceilings.followAll(recordHistory);
    return ok;
  };
  return {
    addStudioRoom(id: Parameters<Edits['addStudioRoom']>[0]) {
      const ok = studio.addStudioRoom(id);
      if (ok) ceilings.followAll();
      return ok;
    },
    editStudio(edit: Parameters<Edits['editStudio']>[0], recordHistory = true, quiet = false) {
      return apply(() => studio.editStudio(edit, recordHistory, quiet), recordHistory);
    },
    resizeWallLength(id: string, length: number, recordHistory = true, quiet = false) {
      return apply(() => studio.resizeWallLength(id, length, recordHistory, quiet), recordHistory);
    },
  };
}
