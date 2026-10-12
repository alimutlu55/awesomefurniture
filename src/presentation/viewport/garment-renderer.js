import * as THREE from 'three';
import { itemModel, LONG_GARMENTS, SHOE_MODELS, SHORT_GARMENTS } from './item-models';

/** Real items on the rails and shelves: downloaded models of real garments and shoes (item-models.ts), each in its
 * own colour, at its real size. Until a model has loaded, a simple stand-in is drawn instead. Materials are made once
 * per colour and outlive rebuilds (`materials` lists them so a rebuild does not dispose them; `dispose` releases them
 * with the editor).
 * @param {{ resources: { M: Function; fabric?: Function; garmentFabric?: Function }; group: () => THREE.Object3D }} ports */
export function createGarmentRenderer({ resources, group }) {
    const made = new Map();
    const material = (key, make) => made.get(key) ?? made.set(key, make()).get(key);
    /** Which real garment hangs at a place on the rail: long garments where the rail leaves room for them, a mix of
     * short ones elsewhere, stable across rebuilds. */
    const pick = (cx, z, height) => {
        const set = height > 110 ? LONG_GARMENTS : SHORT_GARMENTS;
        return set[Math.abs(Math.round(cx * 7.3 + z * 3.1)) % set.length];
    };
    /** The garment's own photographed fabric tinted by its colour where it has one, else matte cloth in its colour. */
    const clothFor = (name, part, color) => part.material.map
        ? material(name + color, () => {
            const m = /** @type {THREE.MeshStandardMaterial} */ (part.material.clone());
            m.color.set(color).convertSRGBToLinear();
            m.vertexColors = true;
            m.side = THREE.DoubleSide;
            return m;
        })
        : material('cloth' + color, () => resources.garmentFabric(color));
    function garment(cx, top, z, height, depth, color, front = false, pitch = Infinity) {
        const name = pick(cx, z, height), real = itemModel(name);
        const cloth = real?.parts.get('garment'), hangerPart = real?.parts.get('hanger');
        if (real && cloth && hangerPart && resources.garmentFabric) {
            const hung = new THREE.Group();
            const fabric = new THREE.Mesh(cloth.geometry, clothFor(name, cloth, color));
            const wood = new THREE.Mesh(hangerPart.geometry, material('hanger', () => resources.M('#8a6646', { roughness: .45 })));
            for (const o of [fabric, wood]) { o.castShadow = o.receiveShadow = true; hung.add(o); }
            // In profile, as garments hang in a wardrobe: shoulders across the wardrobe's depth, a hanger's width each.
            const turn = front ? 0 : Math.PI / 2, across = front ? real.size.x : real.size.x;
            // Real size, unless the wardrobe is shallower than the garment reaches across it.
            hung.scale.setScalar(Math.min(1, depth / across, (height + 4.2) / real.size.y));
            // Garments never hang perfectly parallel: each turns a little on its hanger.
            hung.rotation.y = turn + Math.sin(cx * 12.9898 + z * 78.233) * .05;
            // The hook rests on the rail (3 cm above `top` is the rail's centre, 1.2 cm its radius).
            hung.position.set(cx, top + 3 + 1.2, z);
            group().add(hung);
            return;
        }
        const sh = new THREE.Shape();
        sh.moveTo(-depth * .13, 0);
        sh.lineTo(depth * .13, 0);
        sh.quadraticCurveTo(depth * .25, -3, depth * .43, -7);
        sh.lineTo(depth * .48, -height * .91);
        sh.quadraticCurveTo(0, -height * 1.03, -depth * .48, -height * .95);
        sh.lineTo(-depth * .43, -7);
        sh.quadraticCurveTo(-depth * .25, -3, -depth * .13, 0);
        // Cloth with some body, on a wooden hanger hooked over the rail.
        const fabric = resources.fabric ? resources.fabric(color) : resources.M(color);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1.1, bevelSegments: 3, steps: 1, curveSegments: 8 }), mesh = new THREE.Mesh(geo, fabric);
        geo.translate(0, 0, -1.1);
        const hanger = resources.M('#7a6148', { roughness: .45 }), steel = resources.M('#a7a49e', { metalness: .8, roughness: .3 });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(depth * .86, 1.1, 1.1), hanger), hook = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 3.2, 6), steel);
        bar.position.set(0, -1.6, 0);
        hook.position.set(0, .6, 0);
        mesh.add(bar, hook);
        bar.castShadow = true;
        // Garments never hang perfectly parallel: each turns a little on its hanger.
        const turn = Math.sin(cx * 12.9898 + z * 78.233) * .09;
        mesh.rotation.y = (front ? 0 : Math.PI / 2) + turn;
        // Some garments are bulkier than others: a knit against a shirt.
        mesh.scale.z = 1.25 + .45 * Math.abs(Math.sin(cx * 3.7 + z * 5.1));
        mesh.position.set(cx, top, z);
        mesh.castShadow = mesh.receiveShadow = true;
        group().add(mesh);
    }
    /** A real pair of shoes, toes to the room, standing on `y`; null where the models have not loaded. `height` is
     * the room above the shelf, `length` the shelf's usable depth; `index` picks the shoe and its shade, so a shelf
     * holds a mix of men's and women's shoes. */
    function shoes(x, y, z, height, length, index) {
        const kind = SHOE_MODELS[index % SHOE_MODELS.length], real = itemModel(kind.name), part = real?.parts.get('shoe');
        if (!real || !part) return null;
        const shade = kind.shades[Math.floor(index / SHOE_MODELS.length) % kind.shades.length];
        const skin = material(kind.name + shade, () => {
            const m = /** @type {THREE.MeshStandardMaterial} */ (part.material.clone());
            m.color?.set(shade).convertSRGBToLinear();
            return m;
        });
        const s = Math.min(1, height / real.size.y, length / real.size.z), pair = new THREE.Group();
        for (const side of kind.pair ? [1] : [-1, 1]) {
            const shoe = new THREE.Mesh(part.geometry, skin);
            shoe.scale.set(side * s, s, s);
            if (!kind.pair) shoe.position.x = side * real.size.x * s * .62;
            shoe.castShadow = shoe.receiveShadow = true;
            pair.add(shoe);
        }
        pair.position.set(x, y, z);
        group().add(pair);
        return pair;
    }
    return { garment, shoes, materials: () => [...made.values()], dispose: () => made.forEach(m => m.dispose()) };
}
