import * as THREE from 'three';
export function createRenderState() {
    return {
        wardrobeGroups: [],
        allHits: [],
        allItemHits: [],
        renderActive: true,
        renderCabinet: null,
        selMarks: [],
        overlayHeld: false,
        Gr: null,
        hits: [],
        pivots: [],
        labs: [],
        outs: [],
        ihits: [],
        itemGroups: [],
        settling: [],
        dividerVisuals: [],
        buildStamp: 0,
        previewGroup: null,
        prevLab: {},
        pv: new THREE.Vector3(),
        pv2: new THREE.Vector3(),
        moveIcons: [],
        itemEdgeHandles: [],
        lastFrameTime: null,
        garments: []
    };
}
