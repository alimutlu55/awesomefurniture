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
        popMin: false
    };
}
