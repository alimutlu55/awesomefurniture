import { createSceneMeasurements, type SceneMeasurement } from './scene-measurements';
import type { createEditorModel } from '../projects/editor-model';

/** One transaction for every non-cabinet badge, independent of presentation. */
export function createMeasurementPreview({ model, checkpoint }: {
    model: Pick<ReturnType<typeof createEditorModel>, 'scene' | 'snapshot' | 'restore'>; checkpoint(before: string): void;
}) {
    const measurements = createSceneMeasurements(() => model.scene);
    let session: { ref: SceneMeasurement; before: string; start: number } | null = null;
    return {
        active: () => session !== null, read: measurements.read,
        begin(ref: SceneMeasurement) {
            const start = measurements.read(ref);
            if (start === null) return;
            session = { ref, before: model.snapshot(), start };
        },
        preview(delta: number) {
            const s = session;
            if (!s || !Number.isFinite(delta)) return null;
            const apply = (fraction: number) => {
                model.restore(s.before);
                return fraction === 0 || Math.abs(delta) < .001 || measurements.apply(s.ref, Math.round((s.start + delta * fraction) * 10) / 10);
            };
            if (!apply(1)) {
                let lo = 0, hi = 1;
                for (let n = 0; n < 9; n++) { const mid = (lo + hi) / 2; if (apply(mid)) lo = mid; else hi = mid; }
                apply(lo);
            }
            return measurements.read(s.ref);
        },
        finish(cancel: boolean) {
            const s = session; session = null;
            if (!s) return false;
            if (cancel) { model.restore(s.before); return false; }
            if (model.snapshot() === s.before) return false;
            if (s.ref.kind === 'studio') measurements.settle();
            checkpoint(s.before); return true;
        },
    };
}
