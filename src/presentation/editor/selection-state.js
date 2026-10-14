export function createSelectionState() {
    return { responsivePanel: null,
        /** @type {'studio' | 'wardrobe'} */
        viewMode: 'wardrobe',
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
        room: null
    };
}
