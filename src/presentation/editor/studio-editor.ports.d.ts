import type { RoomSelection } from '../viewport/studio-renderer';
type Point = { x: number; y: number; z: number };

/** A handle on the room: a corner, the grip that moves a wall, "+" on a free wall end, or an opening's grip. */
export interface RoomHandle {
    readonly key: string;
    readonly kind: 'corner' | 'wall' | 'extend' | 'opening';
    readonly id: string;
    x: number; y: number; z: number;
    readonly label: string;
    /** A wall grip's room side, an opening grip's direction along the wall. */
    readonly nx?: number; readonly nz?: number; readonly ux?: number; readonly uz?: number;
}
/** A live dimension: a ruler from a to b, in scene centimetres. */
export interface RoomMeasure { readonly a: Point; readonly b: Point; readonly text: string }

/** Explicit dependencies of the room editor. */
export interface StudioEditorPorts {
    readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'snapshot' | 'restore'>;
    readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'editStudio' | 'studioProblem' | 'addStudioWall' | 'addStudioOpening'>>;
    readonly history: { checkpoint(snapshot: string): void };
    readonly picking: {
        groundPoint(e: PointerEvent, height?: number): { x: number; z: number } | null;
        screenPoint(p: Point): { x: number; y: number };
    };
    readonly selectionState: { room?: RoomSelection; focusOn: boolean };
    readonly callbacks: {
        /** The selection changed: rebuild the view, toolbar and panels. */
        selectionChanged(): void;
        /** The room changed during a drag: redraw it and its handles, nothing else. */
        redraw(): void;
        /** The room changed: rebuild everything. */
        refresh(): void;
        histUI(): void;
        report(message: string): void;
    };
}
