import type { RoomSelection } from '../viewport/studio-renderer';
type Point = { x: number; y: number; z: number };

/** A handle on the room: a corner, "+" on a free wall end, a ceiling's height pill or depth grip. A wall,
 * an opening or a ceiling dragged by its own surface gets a handle where it was grabbed, never drawn. */
export interface RoomHandle {
    readonly key: string;
    readonly kind: 'corner' | 'wall' | 'extend' | 'opening' | 'ceiling' | 'ceiling-split' | 'wall-split' | 'depth' | 'tilt' | 'lift';
    readonly id: string;
    x: number; y: number; z: number;
    readonly label: string;
    /** A ceiling pill: which point of the profile, and the height it shows. */
    readonly index?: number; readonly text?: string;
    readonly position?: number; readonly fraction?: number;
    /** A wall grip's room side, an opening grip's direction along the wall. */
    readonly nx?: number; readonly nz?: number; readonly ux?: number; readonly uz?: number;
}
/** A live dimension: a ruler from a to b, in scene centimetres. */
export interface RoomMeasure {
    readonly a: Point; readonly b: Point; readonly text: string;
    /** The field a tap on it opens, to type the length exactly. */
    readonly edit?: string;
    /** A vertical measurement (a height); lengths on the floor by default. */
    readonly axis?: 'height';
}

/** Explicit dependencies of the room editor. */
export interface StudioEditorPorts {
    readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene' | 'snapshot' | 'restore'>;
    readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>, 'editStudio' | 'studioProblem' | 'addStudioWall' | 'addStudioOpening' | 'followCeilings' | 'standingAgainst' | 'carryWardrobes'>>;
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
        /** A drag reshaped wardrobes under a ceiling: rebuild them too. */
        rebuild(): void;
        /** Opens the toolbar's fields for the selection, with one field in focus (tap to type). */
        openFields(action: string, field: string): void;
        /** The room changed: rebuild everything. */
        refresh(): void;
        histUI(): void;
        report(message: string): void;
    };
}
