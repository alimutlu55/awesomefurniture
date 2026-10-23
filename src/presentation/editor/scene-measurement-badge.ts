import type { SceneMeasurement } from '../../application/commands/scene-measurements';
import { decorateMeasurementBadge } from '../components/measurement-badge';

/** Viewport measurements are read-only; exact edits belong in the inspector. */
export function sceneMeasurementBadge(el: HTMLElement, ref: SceneMeasurement, label: string, value: number,
    orientation: 'horizontal' | 'vertical', min = 0, max = 2000) {
    const encoded = encodeURIComponent(JSON.stringify(ref));
    el.dataset.sceneMeasurement = encoded;
    decorateMeasurementBadge(el, { id: 'scene:' + encoded, label, value, orientation, min, max, readOnly: true });
    el.onclick = null; el.onpointerdown = null; el.onkeydown = null;
}
