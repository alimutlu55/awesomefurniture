import type { Studio } from '../../domain/studio/studio';

/** Explicit dependencies of the Shape editor: the face-on drawing of a wall or a ceiling shape. */
export interface SurfaceShapeEditorPorts {
    readonly document: Document;
    readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'snapshot' | 'restore'>;
    readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'followCeilings'>> & {
        /** Applies a room edit after the room's rules; `recordHistory` false previews a drag, `quiet` keeps refusals silent. */
        editStudio(edit: (room: Studio) => Studio | null, recordHistory?: boolean, quiet?: boolean): boolean;
    };
    readonly history: { checkpoint(snapshot: string): void };
    readonly listen: (target: EventTarget, type: string, handler: (e: Event) => void, options?: boolean | AddEventListenerOptions) => void;
    readonly callbacks: {
        /** The room changed during a drag: redraw it. */
        redraw(): void;
        /** Wardrobes under a ceiling changed shape during a drag: rebuild them too. */
        rebuild(): void;
        /** An edit was committed: rebuild everything and the undo buttons. */
        refresh(): void;
        report(message: string): void;
        /** Undo or redo, for phones, where the sheet stands in for the toolbar. */
        history(step: 'undo' | 'redo'): void;
        /** The drawing turned to the front or the side: turn the room's view with it. */
        viewChanged(): void;
    };
}
