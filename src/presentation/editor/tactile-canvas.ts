import { createTactileEdits } from '../../application/commands/tactile-edits';
import { bindAccordionGestures } from './accordion-gestures';
import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';

export function bindTactileCanvas(ports: MountEditorBindingsPorts) {
    const edits = createTactileEdits({ model: ports.model, checkpoint: ports.history.checkpoint });
    bindAccordionGestures({ ...ports, edits });
}
