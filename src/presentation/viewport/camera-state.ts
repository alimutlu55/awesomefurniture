import * as THREE from 'three';
import type {CameraState} from './camera-types';
export function createCameraState({reducedMotion={matches:false}}: {reducedMotion?:{readonly matches:boolean}} = {}):CameraState {
    return {
        az: .08,
        el: .08,
        dist: 420,
        tgt: new THREE.Vector3(0, 115, 0),
        tgtY: 115,
        initialCameraFraming: true,
        vs: 0,
        vsT: 0,
        vz: 1,
        vzT: 1,
        fitDist: 420,
        camGoal: null,
        camHome: null,
        camRestore: null,
        zoomTarget: null,
        zoomAnchor: null,
        zoomFocus: null,
        reducedCameraMotion: reducedMotion
    };
}
