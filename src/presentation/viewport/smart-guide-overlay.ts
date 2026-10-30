import * as THREE from 'three';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { fittingSmartGuides, boardSmartGuides } from '../editor/interior-smart-guides';
import { cabinetFrame, cabinetSmartGuides, rotationSmartGuides, outlineSmartGuides } from '../editor/scene-smart-guides';
import { roomSmartGuides } from '../editor/room-smart-guides';
import { selectSmartGuides, type GuidePoint, type SmartGuide } from '../editor/smart-guides';
import type { CreateCabinetRendererPorts } from './cabinet-renderer.ports';

interface GuideInteraction {
    rotationGesture?: { moved: boolean } | null;
    wardrobeGesture?: { moved: boolean } | null;
    dividerGesture?: { moved: boolean; index: number } | null;
    itemEdgeGesture?: { moved: boolean; section: number; index: number; edge: string } | null;
    drag?: { from: { i: number; j: number } } | null;
    previewPlan?: { valid: boolean; swap?: boolean; to: number; index: number; from?: { i: number; j: number };
        layouts?: Record<number, import('../editor/interior-smart-guides').GuideRect[]> } | null;
}
type Ports = Pick<CreateCabinetRendererPorts, 'dom' | 'model' | 'resources' | 'selectionState' | 'shapeInspector' | 'studioEditor'>
    & { interactionState: GuideInteraction };
const NS = 'http://www.w3.org/2000/svg';
interface GuideField { key: string; room: boolean; outline?: { index: number; side: 'front' | 'rear'; axis: string } }

/** One editor-scoped overlay for every spatial interaction. It never intercepts a pointer or writes the model. */
export function createSmartGuideOverlay({ dom, model, resources, interactionState: interaction, selectionState: selection,
    shapeInspector, studioEditor }: Ports) {
    const host = dom.$('#view'), owner = host?.ownerDocument;
    if (!host || !owner?.createElementNS) return { draw() {}, dispose() {} };
    const scope = host.getRootNode() as Document | ShadowRoot;
    const layer = owner.createElement('div'); layer.className = 'smart-guides'; layer.dataset.smartGuides = '';
    const svg = owner.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true');
    layer.append(svg); host.append(layer);
    const pool: { group: SVGGElement; path: SVGPathElement }[] = [];
    let held = new Set<string>(), lastContext = '';
    const vector = new THREE.Vector3();
    function field(): GuideField | null {
        const active = scope.querySelector<HTMLElement>('[data-smart-guide-active]') ?? scope.activeElement;
        if (!(active instanceof owner!.defaultView!.HTMLElement)) return null;
        if (active.matches('input[data-k]')
            && active.closest('[data-editor-id="shape-panels"]')) {
            return { key: 'outline', room: false, outline: { index: Number(active.dataset.p ?? active.dataset.s),
                side: active.dataset.side === 'rear' ? 'rear' : 'front', axis: active.dataset.k! } };
        }
        if (!active.hasAttribute('data-smart-guide-active')) return null;
        const input = active.matches('input[type="number"]') ? active
            : active.closest('.resize-field-control')?.querySelector<HTMLElement>('input[type="number"]');
        return input ? { key: input.dataset.roomField ?? dom.controlId(input), room: input.dataset.roomField !== undefined } : null;
    }
    function candidates(): { key: string; guides: SmartGuide[] } {
        const c = model.scene.wardrobes.find(w => w.id === model.scene.activeWardrobe), control = field();
        const standing = () => model.scene.wardrobes.map(w => ({ x: w.x, z: w.z, angle: w.angle,
            w: w.state.w, h: (w.y || 0) + w.state.h, d: w.state.d }));
        if (control?.room && model.scene.studio) return { key: 'room:' + selection.room?.id + ':' + control.key,
            guides: roomSmartGuides(model.scene.studio, selection.room, control.key, standing()) };
        if (studioEditor?.dragging()) {
            const guides = studioEditor.guides().filter(g => g.info === undefined).map((g, i) => {
                const a = { ...g.a, y: g.a.y ?? 0 }, b = { ...g.b, y: g.b.y ?? 0 };
                return { id: 'room:' + i, group: 'room:' + i, label: g.label, a, b, current: b, target: b, delta: 0 };
            });
            return { key: 'room-drag:' + studioEditor.dragKey(), guides };
        }
        if (!c) return { key: '', guides: [] };
        if (control?.outline) return { key: `outline-field:${c.id}:${control.outline.index}:${control.outline.side}:${control.outline.axis}`,
            guides: outlineSmartGuides(model.scene, c, control.outline.index, control.outline.side, control.outline.axis) };
        if (interaction.rotationGesture?.moved) return { key: `rotation:${c.id}`, guides: rotationSmartGuides(model.scene, c) };
        if (interaction.wardrobeGesture?.moved || selection.editingSize) return { key: `cabinet:${c.id}:${selection.editingSize}`,
            guides: cabinetSmartGuides(model.scene, c, selection.editingSize || undefined) };
        const drag = shapeInspector?.drag(), plan = interaction.previewPlan, a = interaction.itemEdgeGesture;
        const fittingControl = control && (control.key === 'iw' || control.key === 'ih');
        const boardControl = control && /^dgap/.test(control.key);
        if (!interaction.dividerGesture?.moved && !boardControl && !a?.moved && !fittingControl && !plan?.valid && !drag?.moved) {
            return { key: '', guides: [] };
        }
        const geometry = createWardrobeGeometry(() => c.state), s = c.state;
        const frame = (x: number, y: number) => cabinetFrame(c)(x - s.w / 2, y);
        if (interaction.dividerGesture?.moved || boardControl) {
            const index = interaction.dividerGesture?.index ?? s.divider;
            return { key: `board:${c.id}:${index}`, guides: boardSmartGuides(s, geometry, index, frame) };
        }
        if (a?.moved || fittingControl) {
            const section = a?.section ?? s.sel, index = a?.index ?? s.item, g = geometry.itemGeom(section, index);
            if (!g) return { key: '', guides: [] };
            const edge = a?.edge ?? (control?.key === 'ih' ? 'top' : geometry.widthEdgeFor(g));
            const rect = { ...g, x0: g.x0 - g.bayL, x1: g.x1 - g.bayL };
            return { key: `item:${c.id}:${section}:${index}:${edge}`,
                guides: fittingSmartGuides(s, geometry, section, index, rect, frame, edge === 'top' || edge === 'bottom' ? 'y' : 'x', edge) };
        }
        if (plan?.valid && !plan.swap && plan.layouts?.[plan.to]?.[plan.index]) {
            const from = plan.from ?? interaction.drag?.from;
            return { key: `move:${c.id}:${plan.to}`, guides: fittingSmartGuides(s, geometry, plan.to,
                from?.i === plan.to ? from.j : -1, plan.layouts[plan.to]![plan.index]!, frame) };
        }
        if (drag?.moved) {
            return { key: `outline:${c.id}:${drag.side}:${drag.index}`, guides: outlineSmartGuides(model.scene, c, drag.index, drag.side) };
        }
        return { key: '', guides: [] };
    }
    function draw() {
        const rect = resources.cv.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        resources.cam.updateMatrixWorld(true);
        const project = (p: GuidePoint) => {
            vector.set(p.x, p.y, p.z).project(resources.cam);
            return { x: (vector.x * .5 + .5) * rect.width, y: (-vector.y * .5 + .5) * rect.height,
                visible: vector.z >= -1 && vector.z <= 1 };
        };
        const context = candidates();
        if (context.key !== lastContext) { held.clear(); lastContext = context.key; }
        const guides = selectSmartGuides(context.guides, project, held); held = new Set(guides.map(g => g.id));
        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
        layer.hidden = !guides.length;
        layer.dataset.guideCount = String(guides.length);
        const hostRect = host!.getBoundingClientRect();
        layer.style.left = `${rect.left - hostRect.left}px`; layer.style.top = `${rect.top - hostRect.top}px`;
        layer.style.width = `${rect.width}px`; layer.style.height = `${rect.height}px`;
        guides.forEach((g, i) => {
            let row = pool[i];
            if (!row) {
                const group = owner!.createElementNS(NS, 'g'), path = owner!.createElementNS(NS, 'path');
                group.append(path); svg.append(group);
                row = { group, path }; pool.push(row);
            }
            const a = project(g.a), b = project(g.b), aligned = Math.abs(g.delta) < .001;
            row.group.setAttribute('class', aligned ? 'aligned' : 'near');
            row.path.setAttribute('d', `M${a.x},${a.y}L${b.x},${b.y}`);
            row.group.style.display = '';
        });
        pool.slice(guides.length).forEach(row => { row.group.style.display = 'none'; });
    }
    return { draw, dispose() { held.clear(); pool.length = 0; layer.remove(); } };
}
