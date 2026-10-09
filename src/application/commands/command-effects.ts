/** Optional presentation effects around an application command. */
export interface CommandEffects {
    getBudget?: () => number;
    report?: (message: string, action?: {
        label: string;
        fn(): void;
    }) => void;
    changed?: (keepSelection?: boolean) => void;
    checkpoint?: () => void;
    discardCheckpoint?: () => void;
    closeInspector?: () => void;
    milestone?: (key: 'cut' | 'tune' | 'paint') => void;
    selectionChanged?: (selection: {
        deep?: boolean;
        pillOn?: boolean;
    }) => void;
    requestUndo?: () => void;
}
