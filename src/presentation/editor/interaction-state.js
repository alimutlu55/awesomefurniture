import * as THREE from 'three';
export function createInteractionState() {
    return {
        rotationGesture: null,
        wardrobeGesture: null,
        dividerGesture: null,
        itemEdgeGesture: null,
        // All primary presses on the canvas, including presses delegated to a
        // furniture, divider or room drag. Tools must not bypass canvas
        // registration or release cleanup when taking over a press.
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
        /** A right- or middle-button drag (or Shift-drag on empty space) that pans the view.
         * @type {{ id: number; x: number; y: number } | null} */
        panGesture: null,
        panelWasOpen: false,
        ray: new THREE.Raycaster()
    };
}
