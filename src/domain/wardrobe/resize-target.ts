/** Selection priority for the shared resize workflow, independent of the UI. */
export function resizeTarget(selection: {item:number;divider:number}): 'wardrobe' | 'item' | 'divider' {
    if (selection.divider >= 0) return 'divider';
    if (selection.item >= 0) return 'item';
    return 'wardrobe';
}
