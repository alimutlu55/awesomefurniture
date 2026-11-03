import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Fitting } from '../../domain/make/make-joints';
import { cargoPulloutGeometry } from '../../domain/kitchen/cargo-pullout';

/** Carrier and upper/lower slides share the GTV Cargo Movix geometry (374 mm vertical slide spacing); the cabinet channels stay fixed. */
export function cargoRunnerMeshes(piece: MakePiece, f: Fitting, geometry: THREE.BufferGeometry, metal: THREE.Material) {
  const front = piece.boards[f.runner!.moving[0]!]!, cx = (front.x0 + front.x1) / 2;
  const config = piece.fittings.find(q => q.size?.startsWith('cargo frame:'))?.size?.split(':');
  const mount = config?.[3] === 'left' ? 'left' : config?.[3] === 'right' ? 'right' : 'bottom';
  const geo = f.cargo ?? cargoPulloutGeometry(cx, front.y0, front.x1 - front.x0, front.y1 - front.y0, piece.size.d, { mount });
  return f.runner!.fixed.flatMap((board, k) => {
    const host = piece.boards[board]!, upperHost = host.name === 'Top';
    // Base units mount both the lower slide (min 50 mm) and upper slide (+374 mm) on the same host; tall units split Base and Top.
    const slideLevels = geo.isTall
      ? [{ bounds: upperHost ? geo.runners.top! : geo.runners.bottom, isUpper: upperHost }]
      : [
          { bounds: geo.runners.bottom, isUpper: false },
          ...(geo.runners.top ? [{ bounds: geo.runners.top, isUpper: true }] : []),
        ];
    return slideLevels.flatMap(({ bounds, isUpper }) => {
      const x = mount !== 'bottom' && !upperHost ? (mount === 'left' ? host.x1 + .5 : host.x0 - .5) : cx;
      const y = upperHost ? host.y0 - 1.5 : mount === 'bottom' && !isUpper ? host.y1 + 1.5 : (bounds.y0 + bounds.y1) / 2;
      return [0, .5, 1].map(ratio => {
        const mesh = new THREE.Group();
        mesh.position.set(x - piece.size.w / 2, y, (bounds.z0 + bounds.z1) / 2 - piece.size.d / 2);
        const bar = new THREE.Mesh(geometry, metal);
        bar.scale.set(mount !== 'bottom' ? 1.2 : isUpper ? 3 : 4, mount !== 'bottom' ? 3.2 : .8, geo.runners.length * (1 - ratio * .06));
        if (mount !== 'bottom') bar.position.x = (mount === 'left' ? 1 : -1) * ratio * .45;
        else bar.position.y = ratio * .7;
        mesh.add(bar);
        return { mesh, board, moving: f.runner!.moving[k]!, ratio };
      });
    });
  });
}
