import { framedExtent } from './framed-extent';
import * as THREE from "three";
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { studioBounds } from '../../domain/studio/studio';
import { zoomOutTarget } from './zoom-out';
import { phoneFraming } from './phone-framing';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./camera-controller.ports').CreateCameraControllerPorts} ports */
export function createCameraController({ dom, clock = performance, inspector, picking, cameraState, interactionState, renderState, geometry, cabinetGeometry, resources, model, viewport }) {
    const { $, document } = dom;
    let mobileInspectorFraming = false;
    /** A box being framed (the whole room): fitted again when the view changes size, as a sheet closes. */
    let boxFraming = null;
    let wardrobeFraming = false;
    let mobileSelectionFraming = false;
    let lastViewWidth = 0, lastViewHeight = 0;
    /** @param {{ instant?: boolean; az?: number; el?: number; padding?: number }} options */
    const fit = (options = {}) => {
        camRelease();
        if (!options.instant) cameraState.initialCameraFraming = false;
        // With every wardrobe removed there is nothing to frame: show the room, or a small floor area without one.
        const empty = !model.scene.wardrobes.length ? (model.scene.studio ? sceneBox() : { x: 0, z: 0, w: 240, d: 240, h: 120 }) : undefined;
        const goal = fittedCamera(options.az ?? cameraState.az, options.el ?? cameraState.el, options.padding ?? 1.08, empty);
        cameraState.fitDist = goal.dist;
        cameraState.vsT = baseShift(goal);
        cameraState.vzT = 1;
        cameraTransition(goal, options.instant ? 0 : 620);
    };
    const cameraAngleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
    const cameraEase = t => t * t * t * (t * (t * 6 - 15) + 10);
    const cameraDistance = d => Math.max(120, Math.min(15000, d));
    const cameraNearDistance = d => Math.max(1, Math.min(50, d * .005));
    const camNow = () => ({ az: cameraState.az, el: cameraState.el, dist: cameraState.dist, x: cameraState.tgt.x, z: cameraState.tgt.z, y: cameraState.tgt.y });
    function modelHalfWidthPx(g) {
        const { angle, box } = selectionFocusBox(), r = $('#view').getBoundingClientRect(), a = (g?.az ?? cameraState.az) - angle, e = g?.el ?? cameraState.el, d = g?.dist ?? cameraState.dist, tanH = Math.tan(35 * Math.PI / 360) * r.width / r.height;
        let frac = 0;
        for (const x of [-box.w / 2, box.w / 2]) {
            for (const y of [-box.h / 2, box.h / 2]) {
                for (const z of [-box.d / 2, box.d / 2]) {
                    const depth = x * Math.cos(e) * Math.sin(a) + y * Math.sin(e) + z * Math.cos(e) * Math.cos(a), horizontal = x * Math.cos(a) - z * Math.sin(a), range = Math.max(1, d - depth);
                    frac = Math.max(frac, Math.abs(horizontal) / (range * tanH));
                }
            }
        }
        return Math.min(1, frac) * r.width / 2;
    }
    // Desktop inspector gently offsets the camera so the model is centered in the remaining view.
    function baseShift(g) {
        if (cameraState.initialCameraFraming || dom.width <= 900) return 0;
        const hasLeft = $('#app').classList.contains('props-open') || document.querySelector('#pop2.show') || document.querySelector('#pop3.show') || document.querySelector('#pop4.show');
        if (!hasLeft) return 0;
        const left = 340, fallback = left / 2;
        try {
            const W = $('#view').getBoundingClientRect().width, half = modelHalfWidthPx(g), gap = 24, lo = left + gap - (W / 2 - half), hi = W - gap - (W / 2 + half);
            if (!Number.isFinite(half) || half <= 0) return fallback;
            if (lo > hi) return (lo + hi) / 2;
            return Math.max(lo, Math.min(hi, fallback));
        } catch (err) {
            return fallback;
        }
    }
    /** @param {{width:number,height:number}} [size] Drawing-buffer layout, when already known by the resize observer. */
    function applyView(size) {
        const r = size ?? resources.cv.getBoundingClientRect();
        resources.cam.aspect = r.width / r.height;
        resources.cam.zoom = cameraState.vz;
        if (Math.abs(cameraState.vs) > .5) {
            resources.cam.setViewOffset(r.width, r.height, -cameraState.vs, 0, r.width, r.height);
        }
        else {
            resources.cam.clearViewOffset();
        }
        resources.cam.updateProjectionMatrix();
    }
    function availableRoom() {
        const r = $('#view').getBoundingClientRect(), desktop = dom.width > 900;
        const hasLeft = desktop && ($('#app').classList.contains('props-open') || document.querySelector('#pop2.show') || document.querySelector('#pop3.show') || document.querySelector('#pop4.show'));
        return { w: Math.max(160, r.width - (hasLeft ? 360 : 28)), h: Math.max(140, r.height - (desktop ? 140 : 115)) };
    }
    /** @param {import('./camera-types').CameraPose} from
     * @param {import('./camera-types').CameraPose} to
     * @returns {import('./camera-types').CameraPose} */
    function cameraSample(from, to, t) {
        const k = cameraEase(Math.max(0, Math.min(1, t))), out = { az: 0, el: 0, dist: 0, x: 0, y: 0, z: 0 };
        for (const key of ['el', 'x', 'y', 'z']) {
            out[key] = from[key] + (to[key] - from[key]) * k;
        }
        out.az = from.az + cameraAngleDelta(from.az, to.az) * k;
        out.dist = Math.exp(Math.log(from.dist) + (Math.log(to.dist) - Math.log(from.dist)) * k);
        if (to.arc) out.dist *= 1 + to.arc * Math.sin(Math.PI * k);
        return out;
    }
    function cameraApply(p) {
        cameraState.az = p.az;
        cameraState.el = p.el;
        cameraState.dist = p.dist;
        cameraState.tgt.set(p.x, p.y, p.z);
        cameraState.tgtY = p.y;
    }
    function cameraTransition(goal, duration = 560) {
        const pending = cameraState.camGoal;
        if (pending && duration > 0 &&
            Math.hypot(goal.x - pending.x, goal.y - pending.y, goal.z - pending.z) < 1 &&
            Math.abs(Math.log(goal.dist / pending.dist)) < .002 &&
            Math.abs(cameraAngleDelta(goal.az, pending.az)) < .001 && Math.abs(goal.el - pending.el) < .001) return;
        cameraState.zoomTarget = cameraState.zoomAnchor = cameraState.zoomFocus = null;
        cameraState.panned = false;
        const from = camNow();
        cameraState.camGoal = { ...goal, from, start: clock.now(), duration };
        if (cameraState.reducedCameraMotion.matches || duration === 0) {
            cameraApply(goal);
            cameraState.camGoal = null;
        }
    }
    function cameraFlyTo(goal, pan = false) {
        const from = camNow(), travel = Math.hypot(goal.x - from.x, goal.y - from.y, goal.z - from.z), dr = Math.abs(Math.log(goal.dist / from.dist));
        const turn = Math.abs(cameraAngleDelta(from.az, goal.az)) + Math.abs(goal.el - from.el);
        if (travel < 2 && dr < .02 && turn < .01) return;
        const duration = Math.round(Math.max(280, Math.min(650, 280 + travel / Math.max(goal.dist, from.dist) * 300 + dr * 200 + turn * 70)));
        cameraTransition({ ...goal, arc: 0 }, duration);
    }
    function cameraFitDistance(bounds, angle, elevation, aspect) {
        const tanV = Math.tan(35 * Math.PI / 360), tanH = tanV * aspect;
        let distance = 120;
        for (const x of [-bounds.w / 2, bounds.w / 2]) {
            for (const y of [-bounds.h / 2, bounds.h / 2]) {
                for (const z of [-bounds.d / 2, bounds.d / 2]) {
                    const depth = x * Math.cos(elevation) * Math.sin(angle) + y * Math.sin(elevation) + z * Math.cos(elevation) * Math.cos(angle), horizontal = x * Math.cos(angle) - z * Math.sin(angle), vertical = -x * Math.sin(elevation) * Math.sin(angle) + y * Math.cos(elevation) - z * Math.sin(elevation) * Math.cos(angle);
                    distance = Math.max(distance, depth + Math.abs(horizontal) / tanH, depth + Math.abs(vertical) / tanV);
                }
            }
        }
        return distance;
    }
    /** @param {{ x: number; z: number; w: number; d: number; h: number; y?: number }} [bounds] what to fit (the wardrobes by default), aimed at height `y` or its middle */
    function fittedCamera(angle = cameraState.az, elevation = cameraState.el, padding = 1.08, bounds = cabinetGeometry.sceneBounds()) {
        const room = availableRoom(), r = $('#view').getBoundingClientRect(), scale = r.height / room.h;
        return { az: angle, el: elevation, x: bounds.x, y: bounds.y ?? bounds.h / 2, z: bounds.z, dist: cameraFitDistance(bounds, angle, elevation, room.w / room.h) * scale * padding };
    }
    function selectionFocusBox() {
        const w = model.activeCabinet(), angle = w.angle * Math.PI / 180;
        let box = { x: 0, y: model.activeCabinet().state.h / 2, w: model.activeCabinet().state.w, h: model.activeCabinet().state.h, d: model.activeCabinet().state.d };
        const g = model.activeCabinet().state.item >= 0 ? geometry.itemGeom(model.activeCabinet().state.sel, model.activeCabinet().state.item) : null;
        if (g) {
            box = { x: (g.x0 + g.x1) / 2 - model.activeCabinet().state.w / 2, y: (g.y0 + g.y1) / 2, w: g.w + 18, h: g.h + 18, d: model.activeCabinet().state.d };
        }
        else if (model.activeCabinet().state.divider >= 0) {
            const d = model.activeCabinet().state.dividers[model.activeCabinet().state.divider], r = geometry.dividerRect(d), base = -model.activeCabinet().state.w / 2 + PANEL + geometry.widths().slice(0, d.i).reduce((a, b) => a + b + PANEL, 0);
            box = { x: base + (r.x0 + r.x1) / 2, y: geometry.interiorFloor() + (r.y0 + r.y1) / 2, w: Math.max(50, r.x1 - r.x0 + 24), h: Math.max(50, r.y1 - r.y0 + 24), d: model.activeCabinet().state.d };
        }
        else if (inspector.inside()) {
            const r = geometry.sectionSpaceMeasurements(model.activeCabinet().state.sel), base = -model.activeCabinet().state.w / 2 + PANEL + geometry.widths().slice(0, model.activeCabinet().state.sel).reduce((a, b) => a + b + PANEL, 0);
            box = { x: base + (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, w: r.w + 18, h: r.h + 18, d: model.activeCabinet().state.d };
        }
        return { w, angle, box };
    }
    /** Pans the view by screen pixels, so the scene follows the fingers or pointer: across the screen, and
     * vertically either up and down (from eye level) or along the floor away and towards you (from above),
     * blended by elevation. The target stays over the room (or near the wardrobes), so the view cannot be lost. */
    function panBy(dx, dy) {
        const r = $('#view').getBoundingClientRect(), perPx = 2 * cameraState.dist * Math.tan(35 * Math.PI / 360) / Math.max(1, r.height) / cameraState.vz;
        const floor = Math.max(0, Math.min(1, (cameraState.el - .25) / .35)), el = Math.max(.25, cameraState.el);
        const rx = Math.cos(cameraState.az), rz = -Math.sin(cameraState.az), fx = -Math.sin(cameraState.az), fz = -Math.cos(cameraState.az);
        const deep = dy * perPx / Math.sin(el) * floor, up = dy * perPx * (1 - floor);
        const room = model.scene.studio && studioBounds(model.scene.studio), b = cabinetGeometry.sceneBounds();
        const x0 = room ? room.x0 : b.x - b.w / 2 - 300, x1 = room ? room.x1 : b.x + b.w / 2 + 300, z0 = room ? room.z0 : b.z - b.d / 2 - 300, z1 = room ? room.z1 : b.z + b.d / 2 + 300;
        const top = room ? room.height : b.h + 100;
        // A target already outside the area is never pulled back with a jump; it just cannot go further out.
        const keep = (v, lo, hi, old) => Math.max(Math.min(lo, old), Math.min(Math.max(hi, old), v));
        camRelease();
        cameraState.tgt.x = keep(cameraState.tgt.x - rx * dx * perPx + fx * deep, x0, x1, cameraState.tgt.x);
        cameraState.tgt.z = keep(cameraState.tgt.z - rz * dx * perPx + fz * deep, z0, z1, cameraState.tgt.z);
        cameraState.tgt.y = cameraState.tgtY = keep(cameraState.tgt.y + up, 10, top, cameraState.tgt.y);
        cameraState.panned = true;
    }
    function cameraFocusPoint() {
        if (cameraState.panned) return cameraState.tgt.clone();
        if (!mobileSelectionFraming) {
            const w = model.activeCabinet();
            return new THREE.Vector3(w.x, (w.y || 0) + w.state.h / 2, w.z);
        }
        const { w, angle, box } = selectionFocusBox();
        return new THREE.Vector3(w.x + box.x * Math.cos(angle), (w.y || 0) + box.y, w.z - box.x * Math.sin(angle));
    }
    function focusSelection(panOnly = false) {
        const keep = cameraState.dist;
        camRelease();
        cameraState.initialCameraFraming = false;
        const { w, angle, box } = selectionFocusBox();
        const room = availableRoom(), view = $('#view').getBoundingClientRect(), goal = { az: cameraState.az, el: cameraState.el, x: w.x + box.x * Math.cos(angle), z: w.z - box.x * Math.sin(angle), y: (w.y || 0) + box.y, dist: Math.max(120, cameraFitDistance(box, cameraState.az - angle, cameraState.el, room.w / room.h) * (view.height / room.h) * 1.1) };
        if (panOnly) goal.dist = keep;
        cameraState.vsT = baseShift(goal);
        cameraFlyTo(goal, panOnly);
    }
    function camFront() {
        const w = model.activeCabinet(), room = availableRoom(), r = $('#view').getBoundingClientRect(), f = framedExtent(w);
        return { az: w.angle * Math.PI / 180, el: 0, x: w.x, z: w.z, y: f.y, dist: cameraFitDistance(f, 0, 0, room.w / room.h) * (r.height / room.h) * 1.06 };
    }
    function frameMobileInspector(selected = false, resizing = false) {
        cameraState.camHome = cameraState.camRestore = null;
        cameraState.vsT = dom.width > 900 ? baseShift() : 0;
        cameraState.vzT = 1;
        const goal = camFront();
        if (selected) {
            const { w, angle, box } = selectionFocusBox();
            goal.az = cameraState.camGoal?.az ?? cameraState.az;
            goal.el = cameraState.camGoal?.el ?? cameraState.el;
            const room = availableRoom(), view = $('#view').getBoundingClientRect();
            // Bias toward the selection without moving the cabinet centre out of frame.
            const focusX = box.x * .12, focusY = (box.y - w.state.h / 2) * .12, f = framedExtent(w);
            goal.x = w.x + focusX * Math.cos(angle);
            goal.y = f.y + focusY;
            goal.z = w.z - focusX * Math.sin(angle);
            const contextDistance = cameraFitDistance({ w: f.w + 2 * Math.abs(focusX), h: f.h + 2 * Math.abs(focusY), d: f.d }, goal.az - angle, goal.el, room.w / room.h) * (view.height / room.h);
            goal.dist = contextDistance * 1.025;
            // On a phone the camera moves as little as it can for what was chosen (the piece, or its fitting or board):
            // not at all when it is in view at a workable size, else just enough (phone-framing.ts).
            if (dom.width <= 900) {
                const part = w.state.item >= 0 || w.state.divider >= 0, at = part ? box : { x: 0, y: w.state.h / 2, w: w.state.w, h: w.state.h, d: w.state.d };
                const now = cameraState.camGoal ?? camNow(), fit = cameraFitDistance(at, goal.az - angle, goal.el, room.w / room.h) * (view.height / room.h);
                Object.assign(goal, phoneFraming({ cam: resources.cam, view, pose: { ...w, angle }, box: at, fit, dist: now.dist, part }) ?? { x: now.x, y: now.y, z: now.z, dist: now.dist });
            }
        }
        // Panel resizing changes the destination, not the animation's origin or clock.
        if (resizing && cameraState.camGoal) Object.assign(cameraState.camGoal, goal);
        else cameraFlyTo(goal, true);
        mobileInspectorFraming = true;
        mobileSelectionFraming = selected;
    }
    function moveViewOn() {
        cameraState.initialCameraFraming = false;
        cameraState.vsT = baseShift();
        if (!cameraState.camHome) cameraState.camHome = camNow();
        cameraState.camRestore = null;
        const goal = camFront();
        goal.dist *= 1.12;
        cameraTransition(goal, 480);
    }
    /** The whole scene: the room and the wardrobes in it, or without a room the wardrobes with floor around them. */
    function sceneBox() {
        const w = cabinetGeometry.sceneBounds(), room = model.scene.studio && studioBounds(model.scene.studio), m = room ? 0 : 80;
        const x0 = Math.min(w.x - w.w / 2 - m, room ? room.x0 : Infinity), x1 = Math.max(w.x + w.w / 2 + m, room ? room.x1 : -Infinity);
        const z0 = Math.min(w.z - w.d / 2 - m, room ? room.z0 : Infinity), z1 = Math.max(w.z + w.d / 2 + m, room ? room.z1 : -Infinity);
        return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: room ? Math.max(room.height, w.h) : w.h };
    }
    /** Moving a wardrobe from the toolbar: fly to a view of the whole room (or the wardrobes with floor around them)
     * from a little above. The target is absolute, so tapping Move again does not zoom out further. */
    function moveOverview() {
        camRelease();
        cameraTransition(fittedCamera(cameraState.az, Math.max(cameraState.el, .62), 1.05, sceneBox()), 700);
    }
    /** Shows the whole scene from a little above, and keeps it whole while sheets open and close: for adding walls
     * or a wardrobe, and for a room just placed. In a room it looks slightly to one side of the wardrobe wall, so
     * the room's depth reads; without one it keeps the side it looks from. */
    /** @param {{ instant?: boolean }} options */
    function frameScene(options = {}) {
        const room = !!model.scene.studio, facing = (model.activeCabinet().angle ?? 0) * Math.PI / 180;
        // A room with no wardrobe yet (a new design's wall): look straight at it, from a little above and further back.
        if (room && !model.scene.wardrobes.length) { frameBox(sceneBox(), facing, .25, 1.6, false, options.instant); return; }
        frameBox(sceneBox(), room ? facing + .32 : cameraState.az, .5, room ? 1.04 : 1.1, false, options.instant);
    }
    /** Frame the active wardrobe. @param {{ resizing?: boolean; instant?: boolean }} options */
    function frameWardrobe(options = {}) {
        const { resizing = false, instant = false } = options;
        if (!model.scene.wardrobes.length) { frameScene({ instant }); return; }
        const w = model.activeCabinet(), goal = camFront();
        if (!resizing) camRelease();
        wardrobeFraming = true;
        goal.az = (w.angle || 0) * Math.PI / 180 + .08;
        goal.el = .18;
        goal.dist *= 1.15;
        cameraState.vsT = 0;
        cameraState.vzT = 1;
        if (instant) {
            cameraState.fitDist = goal.dist;
            cameraTransition(goal, 0);
        }
        else if (resizing && cameraState.camGoal) Object.assign(cameraState.camGoal, goal);
        else cameraTransition(goal, resizing ? 240 : 700);
    }
    function moveViewOff() {
        if (!cameraState.camHome) return;
        const home = cameraState.camHome;
        cameraState.camHome = null;
        cameraState.camRestore = home;
        cameraTransition(home, 480);
    }
    /** Flies to show a box whole (the room), and keeps it whole while panels open or close around it.
     * @param {{ x: number; z: number; w: number; d: number; h: number; y?: number }} bounds */
    function frameBox(bounds, az, el, padding, resizing = false, instant = false) {
        if (!resizing) camRelease();
        boxFraming = { bounds, az, el, padding };
        const goal = fittedCamera(az, el, padding, bounds);
        if (instant) {
            cameraState.fitDist = goal.dist;
            cameraState.vsT = baseShift(goal);
            cameraState.vzT = 1;
            cameraTransition(goal, 0);
        }
        else if (resizing && cameraState.camGoal) Object.assign(cameraState.camGoal, goal);
        else if (resizing) cameraTransition(goal, 240);
        else cameraFlyTo(goal);
    }
    function camRelease() {
        mobileInspectorFraming = false;
        wardrobeFraming = false;
        boxFraming = null;
        cameraState.camGoal = cameraState.camHome = cameraState.camRestore = cameraState.zoomTarget = cameraState.zoomAnchor = cameraState.zoomFocus = null;
        cameraState.tgtY = cameraState.tgt.y;
        cameraState.vsT = cameraState.vs;
        cameraState.vzT = cameraState.vz;
    }
    function cameraAnchoredTarget(target, anchor, ratio) {
        if (!anchor) return { x: target.x, y: target.y, z: target.z };
        return { x: anchor.x + (target.x - anchor.x) * ratio, y: anchor.y + (target.y - anchor.y) * ratio, z: anchor.z + (target.z - anchor.z) * ratio };
    }
    function cameraZoomPoint(e) {
        resources.cam.updateMatrixWorld(true);
        resources.scene.updateMatrixWorld(true);
        const hit = picking.cast(e, [...renderState.allHits, ...renderState.allItemHits]);
        if (hit) return hit.point.clone();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(resources.cam.getWorldDirection(new THREE.Vector3()), cameraState.tgt);
        return interactionState.ray.ray.intersectPlane(plane, new THREE.Vector3());
    }
    function cameraZoomDistance(next, anchor = cameraState.zoomAnchor) {
        const target = cameraAnchoredTarget(cameraState.tgt, anchor, next / cameraState.dist);
        cameraState.tgt.set(target.x, target.y, target.z);
        cameraState.tgtY = target.y;
        cameraState.dist = next;
    }
    function cameraZoom(factor) {
        if (!Number.isFinite(factor) || factor <= 0) return;
        const base = cameraState.zoomTarget ?? cameraState.dist, from = cameraState.zoomFocus ?? cameraState.tgt.clone();
        camRelease();
        // Zooming out heads for the middle of the studio, so it always ends on the whole of it, and stops a little
        // beyond the view of all of it (zoom-out.ts).
        const all = factor > 1 && overview();
        cameraState.zoomTarget = all ? furthest(base * factor, base, all) : cameraDistance(base * factor);
        const out = all && zoomOutTarget(from, all, base, cameraState.zoomTarget);
        cameraState.zoomFocus = out ? new THREE.Vector3(out.x, out.y, out.z) : cameraFocusPoint();
        if (cameraState.reducedCameraMotion.matches) {
            cameraZoomDistance(cameraState.zoomTarget);
            cameraState.tgt.copy(cameraState.zoomFocus);
            cameraState.tgtY = cameraState.tgt.y;
            cameraState.zoomTarget = cameraState.zoomFocus = null;
        }
    }
    /** The view of the whole scene (the studio, or the wardrobes with floor around them) at the current angle. */
    const overview = () => fittedCamera(cameraState.az, cameraState.el, 1.05, sceneBox());
    /** Zooming out to `next` from `from` goes no further than half again the view of the whole scene. */
    const furthest = (next, from, all) => cameraDistance(Math.min(next, Math.max(from, all.dist * 1.5)));
    /** A pinch zooming out to `next`: toward the middle of the studio, as the zoom buttons do. */
    function zoomOutTo(next) {
        const all = overview(), dist = furthest(next, cameraState.dist, all), t = zoomOutTarget(cameraState.tgt, all, cameraState.dist, dist);
        cameraState.tgt.set(t.x, t.y, t.z); cameraState.tgtY = t.y; cameraState.dist = dist;
    }
    function cameraTick(now, dt) {
        if (cameraState.camGoal) {
            const g = cameraState.camGoal, t = cameraState.reducedCameraMotion.matches ? 1 : Math.min(1, (now - g.start) / g.duration);
            cameraApply(cameraSample(g.from, g, t));
            if (t === 1) {
                cameraState.camGoal = null;
                cameraState.camRestore = null;
            }
        }
        if (cameraState.zoomTarget !== null) {
            const k = cameraState.reducedCameraMotion.matches ? 1 : 1 - Math.exp(-dt * 18);
            cameraZoomDistance(Math.exp(Math.log(cameraState.dist) + (Math.log(cameraState.zoomTarget) - Math.log(cameraState.dist)) * k));
            if (cameraState.zoomFocus) {
                cameraState.tgt.lerp(cameraState.zoomFocus, k);
                cameraState.tgtY = cameraState.tgt.y;
            }
            if (Math.abs(cameraState.dist - cameraState.zoomTarget) < .05) {
                cameraZoomDistance(cameraState.zoomTarget);
                if (cameraState.zoomFocus) {
                    cameraState.tgt.copy(cameraState.zoomFocus);
                    cameraState.tgtY = cameraState.tgt.y;
                }
                cameraState.zoomTarget = cameraState.zoomAnchor = cameraState.zoomFocus = null;
            }
        }
    }
    function resize() {
        const r = $('#view').getBoundingClientRect();
        const changed = Math.abs(r.width - lastViewWidth) > 1 || Math.abs(r.height - lastViewHeight) > 1;
        lastViewWidth = r.width;
        lastViewHeight = r.height;
        viewport.resize(r.width, r.height);
        cameraState.vsT = baseShift();
        const p = document.querySelector('.pop.show');
        if (p) {
            inspector.layoutPop(p);
        }
        if (mobileInspectorFraming && changed && r.width > 0 && r.height > 0 && !document.documentElement.hasAttribute('data-keyboard-open')) frameMobileInspector(mobileSelectionFraming, true);
        else if (wardrobeFraming && changed && r.width > 0 && r.height > 0) frameWardrobe({ resizing: true });
        else if (boxFraming && changed && r.width > 0 && r.height > 0) frameBox(boxFraming.bounds, boxFraming.az, boxFraming.el, boxFraming.padding, true);
    }
    return { cameraAngleDelta, cameraEase, cameraDistance, cameraNearDistance, camNow, modelHalfWidthPx, baseShift, applyView, availableRoom, cameraSample, cameraApply, cameraTransition, cameraFlyTo, cameraFitDistance, fittedCamera, selectionFocusBox, cameraFocusPoint, focusSelection, camFront, frameMobileInspector, frameBox, frameScene, frameWardrobe, panBy, moveViewOn, moveOverview, moveViewOff, camRelease, cameraAnchoredTarget, cameraZoomPoint, cameraZoomDistance, cameraZoom, zoomOutTo, cameraTick, resize, fit };
}
