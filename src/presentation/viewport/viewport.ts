import type { ProjectDocument } from '../../domain/project/project';
import type { EditorSession } from '../editor/editor-session';

/** The Three.js adapter owns camera, animation, hit testing and disposal. */
export interface Viewport {
  render(project: ProjectDocument, session: EditorSession): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
