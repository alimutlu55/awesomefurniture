import type { ViewportTransform } from './studio-2d-canvas';

function rulerInterval(zoom: number): { step: number; major: number } {
  if (zoom >= 2.0) return { step: 10, major: 50 };
  if (zoom >= 0.8) return { step: 20, major: 100 };
  if (zoom >= 0.3) return { step: 50, major: 200 };
  return { step: 100, major: 500 };
}

function formatMeters(cm: number): string {
  if (cm === 0) return '0';
  const m = cm / 100;
  return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
}

/** Renders the top horizontal ruler SVG. */
export function renderTopRuler(t: ViewportTransform, cursorSceneX?: number): string {
  const { step, major } = rulerInterval(t.zoom);
  const cx = t.width / 2;
  const minSceneX = Math.floor((-cx / t.zoom + t.panX) / step) * step - step * 2;
  const maxSceneX = Math.ceil(((t.width - cx) / t.zoom + t.panX) / step) * step + step * 2;

  const elements: string[] = [
    `<rect width="${t.width}" height="22" class="sp2d-ruler-bg"/>`,
    `<line x1="0" y1="21.5" x2="${t.width}" y2="21.5" class="sp2d-ruler-edge"/>`,
  ];

  for (let x = minSceneX; x <= maxSceneX; x += step) {
    const screenX = Math.round((cx + (x - t.panX) * t.zoom) * 10) / 10;
    if (screenX < -20 || screenX > t.width + 20) continue;
    const isMajor = Math.abs(x) % major === 0;
    const y1 = isMajor ? 8 : 14;
    const cls = isMajor ? 'sp2d-ruler-tick-major' : 'sp2d-ruler-tick-minor';
    elements.push(`<line x1="${screenX}" y1="${y1}" x2="${screenX}" y2="21" class="${cls}"/>`);
    if (isMajor) {
      elements.push(`<text x="${screenX}" y="7" class="sp2d-ruler-text">${formatMeters(x)}</text>`);
    }
  }

  if (cursorSceneX !== undefined) {
    const sx = Math.round((cx + (cursorSceneX - t.panX) * t.zoom) * 10) / 10;
    elements.push(`<line x1="${sx}" y1="0" x2="${sx}" y2="21.5" class="sp2d-ruler-tracker"/>`);
  }

  return `<svg width="${t.width}" height="22" class="sp2d-ruler-top-svg">${elements.join('')}</svg>`;
}

/** Renders the left vertical ruler SVG. */
export function renderLeftRuler(t: ViewportTransform, cursorSceneZ?: number): string {
  const { step, major } = rulerInterval(t.zoom);
  const cz = t.height / 2;
  const minSceneZ = Math.floor((-cz / t.zoom + t.panZ) / step) * step - step * 2;
  const maxSceneZ = Math.ceil(((t.height - cz) / t.zoom + t.panZ) / step) * step + step * 2;

  const elements: string[] = [
    `<rect width="22" height="${t.height}" class="sp2d-ruler-bg"/>`,
    `<line x1="21.5" y1="0" x2="21.5" y2="${t.height}" class="sp2d-ruler-edge"/>`,
  ];

  for (let z = minSceneZ; z <= maxSceneZ; z += step) {
    const screenZ = Math.round((cz + (z - t.panZ) * t.zoom) * 10) / 10;
    if (screenZ < -20 || screenZ > t.height + 20) continue;
    const isMajor = Math.abs(z) % major === 0;
    const x1 = isMajor ? 8 : 14;
    const cls = isMajor ? 'sp2d-ruler-tick-major' : 'sp2d-ruler-tick-minor';
    elements.push(`<line x1="${x1}" y1="${screenZ}" x2="21" y2="${screenZ}" class="${cls}"/>`);
    if (isMajor) {
      elements.push(`<text x="6" y="${screenZ + 3}" class="sp2d-ruler-text" style="text-anchor:end">${formatMeters(z)}</text>`);
    }
  }

  if (cursorSceneZ !== undefined) {
    const sz = Math.round((cz + (cursorSceneZ - t.panZ) * t.zoom) * 10) / 10;
    elements.push(`<line x1="0" y1="${sz}" x2="21.5" y2="${sz}" class="sp2d-ruler-tracker"/>`);
  }

  return `<svg width="22" height="${t.height}" class="sp2d-ruler-left-svg">${elements.join('')}</svg>`;
}
