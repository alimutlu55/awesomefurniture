import { createSurfaceBoundaryCursor } from './surface-boundary-cursor';

export const createWallSplitCursor = (screen: (p: { x: number; y: number; z: number }) => { x: number; y: number }) =>
  createSurfaceBoundaryCursor('wall', screen);
