import * as THREE from "three";
import { collectRenderAssets, disposeCabinetGroup } from './render-disposal';

/** Structural fingerprint of all wardrobes in the scene including active selection scope. Excludes floor pose. */
export function sceneGeometryFingerprint(scene, selectionState, interactionState) {
    if (!scene || !scene.wardrobes) return '';
    const active = scene.activeWardrobe;
    const focus = selectionState?.focusOn ?? false;
    const shape = selectionState?.shapeEditing ?? false;
    const dims = selectionState?.showDimensions ?? false;
    const move = interactionState?.moveMode ? 'm' : '';
    return JSON.stringify([
        active, focus, shape, dims, move,
        scene.wardrobes.map(w => {
            const s = w.state, isAct = w.id === active;
            return [
                w.id, s.w, s.h, s.d, s.n, s.wt,
                s.shape, s.fin, s.materials, s.plinthHeight, s.cornerStrip, s.endPanelThickness, s.endPanelSides,
                s.fridgeSplit, s.frontThickness, s.worktopThickness, s.ventilationWidth, s.ventilationHeight, s.doors, s.open, s.doorHang, s.unit, s.product,
                isAct ? [focus, shape, dims, move, selectionState?.deep, selectionState?.pillOn, s.sel, s.item, s.divider, s.space] : null,
                s.dividers,
                s.secs
            ];
        })
    ]);
}

/** Per-wardrobe design fingerprint including active selection scope. */
export function wardrobeDesignFingerprint(w, activeId, selectionState, interactionState) {
    const s = w.state, isAct = w.id === activeId;
    return JSON.stringify([
        w.id,
        isAct ? [
            selectionState?.focusOn ?? false,
            selectionState?.shapeEditing ?? false,
            selectionState?.showDimensions ?? false,
            interactionState?.moveMode ? 'm' : '',
            selectionState?.deep, selectionState?.pillOn, s.sel, s.item, s.divider, s.space
        ] : null,
        s.w, s.h, s.d, s.n, s.wt,
        s.shape, s.fin, s.materials, s.plinthHeight, s.cornerStrip, s.endPanelThickness, s.endPanelSides,
        s.fridgeSplit, s.frontThickness, s.worktopThickness, s.ventilationWidth, s.ventilationHeight, s.doors, s.open, s.doorHang, s.unit, s.product,
        s.dividers,
        s.secs
    ]);
}

export function createCvRectCache(cv) {
    return function getCvRect() {
        return cv?.getBoundingClientRect?.() ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    };
}

export function createLabelDimMeasurer() {
    return function labelDim(l) {
        const scale = l.canvasScale ?? 1;
        // CSS can change with viewport, focus and inline editing without changing the text.
        return { w: (l.el.offsetWidth || 30) * scale, h: (l.el.offsetHeight || 18) * scale };
    };
}

export function createCabinetBuildCache({ resources, clothes, bags, trousers }) {
    /** @type {Map<number, { key: string; Gr: THREE.Group; hits: any[]; outs: any[]; ihits: any[]; itemGroups: any[]; pivots: any[]; garments: any[]; dividerVisuals: any[]; labs: any[]; assets?: any }>} */
    const cache = new Map();

    function get(id) {
        return cache.get(id);
    }

    function set(id, entry) {
        entry.assets = collectRenderAssets(entry.Gr);
        cache.set(id, entry);
    }

    function retainAssets(id) {
        const entry = cache.get(id);
        if (entry?.assets) {
            clothes?.retain?.(entry.assets.geometries, entry.assets.materials);
            bags?.retain?.(entry.assets.geometries, entry.assets.materials);
            trousers?.retain?.(entry.assets.geometries, entry.assets.materials);
        }
    }

    function disposeWardrobe(id, sharedMaterials, sharedGeometries) {
        const entry = cache.get(id);
        if (entry) {
            resources.scene.remove(entry.Gr);
            disposeCabinetGroup(entry.Gr, sharedMaterials, sharedGeometries);
            entry.labs?.forEach(l => {
                if (!l.el?.classList?.contains('shape-handle') && !l.el?.classList?.contains('array-grip')) {
                    l.el?.remove();
                }
                l.rulerNode?.remove();
            });
            cache.delete(id);
        }
    }

    function pruneExcept(activeIds, sharedMaterials, sharedGeometries) {
        const active = new Set(activeIds);
        for (const [id, entry] of cache) {
            if (!active.has(id)) {
                resources.scene.remove(entry.Gr);
                disposeCabinetGroup(entry.Gr, sharedMaterials, sharedGeometries);
                entry.labs?.forEach(l => {
                    if (!l.el?.classList?.contains('shape-handle') && !l.el?.classList?.contains('array-grip')) {
                        l.el?.remove();
                    }
                    l.rulerNode?.remove();
                });
                cache.delete(id);
            }
        }
    }

    function disposeAll(sharedMaterials, sharedGeometries) {
        for (const [, entry] of cache) {
            resources.scene.remove(entry.Gr);
            disposeCabinetGroup(entry.Gr, sharedMaterials, sharedGeometries);
            entry.labs?.forEach(l => {
                if (!l.el?.classList?.contains('shape-handle') && !l.el?.classList?.contains('array-grip')) {
                    l.el?.remove();
                }
                l.rulerNode?.remove();
            });
        }
        cache.clear();
    }

    return {
        get,
        set,
        retainAssets,
        disposeWardrobe,
        pruneExcept,
        disposeAll
    };
}
