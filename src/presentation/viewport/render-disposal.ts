import { Mesh, Material, Texture } from 'three';
import type { Object3D, BufferGeometry } from 'three';
/** Collect resources by identity, including materials allocated before any mesh uses them. */
export function collectRenderAssets(root: Object3D) {
    const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
    root.traverse(object => {
        if (object instanceof Mesh) {
            geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material])
                materials.add(material);
        }
        // Lines and points also own geometries/materials.
        if ('geometry' in object && object.geometry && typeof object.geometry === 'object' && 'dispose' in object.geometry)
            geometries.add(object.geometry as BufferGeometry);
        if ('material' in object && object.material) {
            const values = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of values)
                if (material instanceof Material)
                    materials.add(material);
        }
        const owned: unknown = object.userData.ownedMaterials;
        if (Array.isArray(owned))
            for (const material of owned)
                if (material instanceof Material)
                    materials.add(material);
    });
    return { geometries, materials };
}
export function disposeCabinetGroup(root: Object3D, shared: ReadonlySet<Material> = new Set()): void {
    const assets = collectRenderAssets(root);
    assets.geometries.forEach(value => value.dispose());
    assets.materials.forEach(value => { if (!shared.has(value))
        value.dispose(); });
}
export function disposeSceneAssets(root: Object3D, sharedTextures: readonly Texture[], sharedMaterials: readonly Material[]): void {
    const { geometries, materials } = collectRenderAssets(root), textures = new Set(sharedTextures);
    sharedMaterials.forEach(value => materials.add(value));
    for (const material of materials)
        for (const value of Object.values(material))
            if (value instanceof Texture)
                textures.add(value);
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
}
