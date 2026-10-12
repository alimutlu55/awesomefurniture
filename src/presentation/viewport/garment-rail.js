import * as THREE from 'three';

/** Garments on a rail, laid out from their physical dimensions (GARMENT_PHOTOS in item-models.ts) and lit like the
 * wardrobe around them. Pure layout first (`railLayout`, testable), then drawing (`drawRail`).
 *
 * - Spacing: neighbouring hooks are half of each garment's thickness apart plus an air gap, so bulky knits take more of
 *   the rail than shirts and overlap their neighbours more; the end garments stay inside the bay.
 * - Variation: order, colour, length (±4 %), profile width (±7 %), turn on the hanger (±9°), tilt (±1.2°) and depth on
 *   the rail (±3 cm) all come from a seeded generator: the same wardrobe always looks the same, two bays never alike.
 *   No garment family follows itself, so no pattern repeats.
 * - Light: the same physical material as the wood (it takes the sun, the ambient and the shadow map: the shelf's, the
 *   rail's and its neighbours'), plus ambient occlusion in vertex colours: under the rail and shelf, at the hook, and
 *   where the next garment hangs in front. */

/** Air between two garments on a rail (cm): a styled wardrobe, not a packed one. */
const AIR = 5.5;
/** Garments on a rail press a little against each other: their profile at this share of the photograph's width. */
const PRESSED = .8;

/** A small, fast seeded random generator (mulberry32): the same seed always gives the same sequence. */
export function seeded(seed) {
    let a = Math.floor(Math.abs(seed) * 9301 + 49297) >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Where each garment hangs on a rail from x0 to x1 with `room` below the hook. Returns one entry per garment: its
 * photo, centre x, depth z, size, turn and tilt, colour, and whether a neighbour hangs in front of its right side. */
export function railLayout(photos, x0, x1, room, seed) {
    const random = seeded(seed), fit = photos.filter(g => g.length <= room - 6), long = fit.filter(g => g.length >= 100);
    // A rail with room for long garments holds them (and trousers, which hang long), else everything that clears below.
    const pool = room >= 120 && long.length ? [...long, ...fit.filter(g => g.family === 'trousers' && !long.includes(g))] : fit.length ? fit : photos.slice(0, 1);
    const out = [];
    let x = x0, last = null;
    for (let guard = 0; guard < 60; guard++) {
        const choices = pool.length > 1 ? pool.filter(g => g.family !== last) : pool, g = choices[Math.floor(random() * choices.length)];
        const length = Math.min(room - 4, g.length * (.96 + random() * .08)), width = length * g.aspect * PRESSED * (.93 + random() * .14);
        const left = out.length ? x + (out[out.length - 1].thickness + g.thickness) / 2 + AIR : x0 + width * g.hook;
        // The garment's right edge must stay inside the bay.
        if (left + width * (1 - g.hook) > x1 + .5) break;
        out.push({ photo: g, hookX: left, length, width, thickness: g.thickness, z: (random() - .5) * 6, turn: (random() - .5) * .32,
            tilt: (random() - .5) * .042, colour: g.colours[Math.floor(random() * g.colours.length)], covered: false });
        x = left;
        last = g.family;
    }
    // Centre the row in the bay, and note which garments a neighbour covers on the right.
    if (out.length) {
        const leftEdge = out[0].hookX - out[0].width * out[0].photo.hook, right = out[out.length - 1], rightEdge = right.hookX + right.width * (1 - right.photo.hook);
        const shift = ((x0 + x1) - (leftEdge + rightEdge)) / 2;
        out.forEach((o, i) => { o.hookX += shift; o.covered = i < out.length - 1; });
    }
    return out;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The garment's plane, w × h, with ambient occlusion in vertex colours: the shelf and rail over the hanger and shoulders,
 * a little contact shade where the hook meets the rail, and, if `covered`, the shade of the garment hanging in front of
 * its right side. Shade warms as it deepens, as light bounced off oak does. */
function occludedPlane(w, h, hook, covered) {
    const geometry = new THREE.PlaneGeometry(w, h, 8, 20), pos = geometry.attributes.position, colours = [];
    for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / w + .5, v = .5 - pos.getY(i) / h;
        const underRail = .58 + .42 * smooth(0, .26, v), atHook = 1 - .25 * (1 - smooth(0, .05, v)) * (1 - smooth(0, .12, Math.abs(u - hook)));
        const light = underRail * atHook * (covered ? 1 - .38 * smooth(.4, 1, u) : 1) * (1 - .08 * v);
        colours.push(light, light * (.96 + .04 * light), light * (.86 + .14 * light));
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    return geometry;
}

/** Draws a rail's garments into `group`. `material(key, make)` caches materials across rebuilds. */
export function drawRail(group, layout, hookY, material) {
    for (const o of layout) {
        const g = o.photo, geometry = occludedPlane(o.width, o.length, g.hook, o.covered);
        // Fabric under the wardrobe's own light: matte, the same physical material model as the oak.
        const cloth = material('cloth' + g.name + o.colour, () => {
            const m = new THREE.MeshStandardMaterial({ map: g.texture, color: new THREE.Color(o.colour).convertSRGBToLinear().multiplyScalar(FABRIC_ALBEDO),
                vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: .35, transparent: true, alphaTest: .02, side: THREE.DoubleSide });
            return m;
        });
        const garment = new THREE.Mesh(geometry, cloth);
        // Its shadow follows the garment's outline, not the photo's rectangle.
        garment.customDepthMaterial = material('depth' + g.name, () => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: g.texture, alphaTest: .5 }));
        garment.castShadow = garment.receiveShadow = true;
        // Hung from the hook: the plane's top at the hook, turned and tilted about it.
        const pivot = new THREE.Group();
        pivot.position.set(o.hookX, hookY, o.z);
        pivot.rotation.set(0, o.turn, o.tilt);
        garment.position.set(o.width * (.5 - g.hook), -o.length / 2, 0);
        pivot.add(garment);
        group.add(pivot);
    }
}

/** The photographs' studio white as fabric albedo: bright cloth reflects about this much of the light. */
const FABRIC_ALBEDO = .82;
