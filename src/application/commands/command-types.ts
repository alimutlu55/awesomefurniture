import type { EditorItem } from '../../domain/wardrobe/editor-design';
import type { ItemKind, StoragePurpose } from '../../domain/wardrobe/wardrobe';
export interface ItemEdit {
    kind?: ItemKind;
    fullWidth?: boolean;
    align?: 'l' | 'c' | 'r';
    stretch?: boolean;
    finish?: EditorItem['f'];
    purpose?: StoragePurpose;
}
export interface ItemMovePlan {
    valid: boolean;
    unchanged?: boolean;
    secs: EditorItem[][];
    to: number;
    index: number;
}
export type ItemResizeTarget = {
    h: number;
} | {
    w: number;
    x: number;
};
export interface ItemResizeSession {
    edge: string;
    original: EditorItem[];
    index: number;
    section: number;
    g: {
        bw: number;
    };
    layout: {
        relY0?: number;
    }[];
}
