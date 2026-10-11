export interface Point3 { x: number; y: number; z: number }
export type CameraTarget = import('three').Vector3;
export interface CameraPose extends Point3 { az: number; el: number; dist: number; arc?: number }
export interface CameraTransition extends CameraPose { from: CameraPose; start: number; duration: number }
export interface CameraState {
  az: number; el: number; dist: number; tgt: CameraTarget; tgtY: number;
  initialCameraFraming: boolean; vs: number; vsT: number; vz: number; vzT: number; fitDist: number;
  camGoal: CameraTransition | null; camHome: CameraPose | null; camRestore: CameraPose | null;
  zoomTarget: number | null; zoomAnchor: import('three').Vector3 | null; zoomFocus: import('three').Vector3 | null;
  reducedCameraMotion: { readonly matches: boolean };
  /** The view was panned by hand: zooming keeps its target instead of returning to the selection. */
  panned?: boolean;
}
