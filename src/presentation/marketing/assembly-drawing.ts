import * as THREE from 'three';
import type { AssemblyPart } from './assembly-model';
import { studyMeasure, type StudyState } from './study';

/** Outline the construction planes, not the small triangles around a rendered bevel. */
export function drawingEdges(part: AssemblyPart): THREE.EdgesGeometry {
  let solid: THREE.BufferGeometry;
  if (part.outline) {
    const shape = new THREE.Shape(part.outline.map(([x, y]) => new THREE.Vector2(x, y)));
    solid = new THREE.ExtrudeGeometry(shape, { depth: part.size[2], bevelEnabled: false, steps: 1 });
    solid.translate(0, 0, -part.size[2] / 2);
  } else if (part.kind === 'rail') {
    solid = new THREE.CylinderGeometry(.009, .009, part.size[0], 16); solid.rotateZ(Math.PI / 2);
  } else solid = new THREE.BoxGeometry(...part.size);
  const edges = new THREE.EdgesGeometry(solid, 35); solid.dispose();
  return edges;
}

/** A thin drafting overlay follows the same camera and model as the construction lines. */
export function assemblyDimensions(host: HTMLElement) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('assembly-drawing'); svg.setAttribute('aria-hidden', 'true');
  host.append(svg);
  const point = new THREE.Vector3();
  return {
    update(camera: THREE.Camera, state: StudyState, base: THREE.Object3D, progress: number, visible: boolean) {
      svg.style.display = visible ? '' : 'none';
      if (!visible) return;
      const width = host.clientWidth, height = host.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const project = (x: number, y: number, z: number): [number, number] => {
        point.set(x, y, z).project(camera);
        return [(point.x + 1) * width / 2, (1 - point.y) * height / 2];
      };
      const basePoint = (x: number): [number, number] => {
        point.set(x, -.009, .3).applyMatrix4(base.matrixWorld).project(camera);
        return [(point.x + 1) * width / 2, (1 - point.y) * height / 2];
      };
      const dimension = (a: [number, number], b: [number, number], offset: number, label: string) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        if (length < 30) return '';
        const nx = -dy / length, ny = dx / length;
        const ax = a[0] + nx * offset, ay = a[1] + ny * offset;
        const bx = b[0] + nx * offset, by = b[1] + ny * offset;
        const line = (x1: number, y1: number, x2: number, y2: number, cls = '') =>
          `<path class="${cls}" d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`;
        const tick = (x: number, y: number) => line(x - nx * 3 - dx / length * 2, y - ny * 3 - dy / length * 2,
          x + nx * 3 + dx / length * 2, y + ny * 3 + dy / length * 2);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const rotation = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
        const tx = (ax + bx) / 2, ty = (ay + by) / 2;
        return `<g>${line(a[0], a[1], ax + nx * 5, ay + ny * 5, 'extension')}
          ${line(b[0], b[1], bx + nx * 5, by + ny * 5, 'extension')}${line(ax, ay, bx, by)}${tick(ax, ay)}${tick(bx, by)}
          <text transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${rotation.toFixed(2)})" dy="-5">${label}</text></g>`;
      };
      const w = state.width / 100, lang = document.documentElement.lang || 'en';
      // This always measures the full-width base panel, including while the other parts are separated.
      let markup = dimension(basePoint(-w / 2), basePoint(w / 2), 22,
        studyMeasure(state.width, state.inches, lang));
      // Overall height is meaningful only once the cabinet is assembled.
      if (progress >= .98) {
        const side = state.shape === 'alcove' ? -1 : 1, x = side * w / 2, z = side < 0 ? .3 : -.3;
        markup += dimension(project(x, 0, z), project(x, 2.4, z), side * 27, studyMeasure(240, state.inches, lang));
      }
      svg.innerHTML = markup;
    },
    dispose() { svg.remove(); },
  };
}
