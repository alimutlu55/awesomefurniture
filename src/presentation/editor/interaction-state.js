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
        /** A press on a wardrobe or cabinet that becomes a move of the whole piece once the pointer moves.
         * @type {{ id: number; event: PointerEvent } | null} */
        pendingFurniture: null,
        /** A right- or middle-button drag (or Shift-drag on empty space) that pans the view.
         * @type {{ id: number; x: number; y: number } | null} */
        panGesture: null,
        panelWasOpen: false,
        ray: new THREE.Raycaster()
    };
}
