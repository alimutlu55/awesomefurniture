import type { EditorScene } from '../projects/editor-scene';
import type { DrawingInput } from '../../domain/drawings/room-pieces';

/** What the drawings, Make and the engine are made from: the room and every piece in it as it stands. */
export function drawingInputOf(scene: EditorScene): DrawingInput {
  return { studio: scene.studio, pieces: scene.wardrobes.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, design: c.state })) };
}
