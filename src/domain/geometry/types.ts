/** Distances are centimetres; rotations are degrees around the vertical axis. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Dimensions {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}
