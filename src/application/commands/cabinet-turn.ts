import type { EditorCabinet } from '../projects/editor-scene';

type TurnPose = Pick<EditorCabinet, 'x' | 'z' | 'angle'>;
interface TurnCommands {
  previewRotation(id: number, angle: number, from: Pick<TurnPose, 'x' | 'z'>): boolean;
  settleCabinet(id: number): string | null | undefined;
  restorePose(id: number, pose: TurnPose): void;
}

/** A quarter turn uses the same collision, wall adjustment and installation checks in either view. */
export function quarterTurnCabinet(cabinet: TurnPose & { id: number }, commands: TurnCommands): boolean {
  const from = { x: cabinet.x, z: cabinet.z, angle: cabinet.angle };
  commands.previewRotation(cabinet.id, (from.angle + 90) % 360, from);
  if (commands.settleCabinet(cabinet.id)) {
    commands.restorePose(cabinet.id, from);
    return false;
  }
  return cabinet.angle !== from.angle || cabinet.x !== from.x || cabinet.z !== from.z;
}
