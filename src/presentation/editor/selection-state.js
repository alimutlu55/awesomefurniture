export function createSelectionState() {
    return { responsivePanel: null,
        showDimensions: true,
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
