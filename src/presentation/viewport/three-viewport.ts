import type { ProjectDocument } from '../../domain/project/project';
import type { EditorSession } from '../editor/editor-session';
import type { Viewport } from './viewport';

export interface ThreeViewportPorts {
 renderModel(project: ProjectDocument, session: EditorSession): void;
 resizeSurface(width: number, height: number): void;
 disposeResources(): void;
}

/** One mounted Three.js viewport; resources are supplied by its composition root. */
export function createThreeViewport(ports: ThreeViewportPorts): Viewport {
 let disposed=false;
 const assertMounted=(): void=>{if(disposed)throw new Error('Viewport has been disposed.');};
 return {
  render(project,session){assertMounted();ports.renderModel(project,session);},
  resize(width,height){assertMounted();if(width>0&&height>0)ports.resizeSurface(width,height);},
  dispose(){if(disposed)return;disposed=true;ports.disposeResources();},
 };
}
