export function createSelectionState() {
    return { responsivePanel: null,
        /** @type {'studio' | 'furniture'} */
        viewMode: 'furniture',
        /** @type {'2d' | '3d'} */
        studioView: '3d',
        /** An opening or ceiling awaiting a wall chosen on the canvas. @type {string | null} */
        pendingStudioAction: null,
        showDimensions: true,
        /** The wardrobe size being slid or typed ('w', 'h' or 'd'): the model shows it with its gaps.
         * @type {false | 'w' | 'h' | 'd'} */
        editingSize: false,
        focusOn: false,
        pillOn: false,
        deep: false,
        itemBar: null,
        itemTypeMenu: null,
        ctxMenu: null,
        itemBarCache: null,
        addKey: null,
        popPos: null,
        popMin: false,
        /** Wardrobe skeleton handles and panel list are open. */
        shapeEditing: false,
        /** The selected wall or opening of the room, when a room part is selected instead of a wardrobe.
         * @type {import('../viewport/studio-renderer').RoomSelection} */
        room: null,
        /** The door leaf chosen by a tap on it ('bay.row.leaf'), with its wardrobe and bay. Not saved, not an undo step;
         * read it through chosenLeaf. @type {{ wardrobe: number, bay: number, key: string } | null} */
        leaf: null
    };
}
/** The chosen door leaf's key while it stays chosen: its wardrobe is the one given and is focused, and its bay is
 * selected (deep) with no fitting or board inside it. Anything else chosen since lets it go. */
export function chosenLeaf(selectionState, wardrobe, state) {
    const leaf = selectionState.leaf;
    return leaf && selectionState.focusOn && selectionState.deep && leaf.wardrobe === wardrobe && state.sel === leaf.bay && !(state.item >= 0) && !(state.divider >= 0) ? leaf.key : null;
}
