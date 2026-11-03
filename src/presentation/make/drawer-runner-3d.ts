import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Fitting } from '../../domain/make/make-joints';
import { telescopicRunnerChannelMeshes } from '../viewport/hardware';

/** Three nested channels, ball tracks and the removable member's release lever, built from the shared hardware entry. */
export function drawerRunnerMeshes(piece: MakePiece, fitting: Fitting, geometry: THREE.BufferGeometry, metal: THREE.Material) {
  return telescopicRunnerChannelMeshes(piece, fitting, geometry, metal);
}
