import * as THREE from 'three';
export function createInteractionState() {
    return {
        rotationGesture: null,
        wardrobeGesture: null,
        dividerGesture: null,
        itemEdgeGesture: null,
        ptrs: new Map(),
        moved: 0,
        pd: 0,
        sx: 0,
        sy: 0,
        drag: null,
        moveMode: null,
        previewPlan: null,
        lastMoveEvent: null,
        rotationClick: false,
        panelWasOpen: false,
        ray: new THREE.Raycaster()
    };
}
