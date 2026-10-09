/** @param {Pick<import('./editor-gestures.ports').CreateEditorGesturesPorts, 'dom' | 'picking' | 'renderState' | 'inspector' | 'selectionState' | 'model' | 'resources'>} ports */
export function createSceneSelection({ dom, picking, renderState, inspector, selectionState, model, resources }) {
    function pick(e) {
        const h = picking.cast(e, renderState.allHits);
        if (!h) {
            inspector.clearFocus();
            return;
        }
        const u = h.object.userData;
        // Decide the selection scope before switching cabinet or rebuilding its hit boxes.
        if (!selectionState.focusOn || u.wardrobe !== model.scene.activeWardrobe) {
            inspector.selectCabinet(u.wardrobe);
            model.activeCabinet().state.sel = u.i;
            inspector.update();
            return;
        }
        const m = picking.cast(e, renderState.allItemHits);
        if (m && m.object.userData.wardrobe === model.scene.activeWardrobe) {
            const item = m.object.userData;
            if (item.divider !== undefined) {
                model.activeCabinet().state.divider = item.divider;
                model.activeCabinet().state.sel = item.i;
                model.activeCabinet().state.item = -1;
                selectionState.deep = true;
                selectionState.pillOn = false;
                inspector.update();
                inspector.showPop(e, '#pop4');
                return;
            }
            model.activeCabinet().state.divider = -1;
            selectionState.deep = true;
            selectionState.pillOn = false;
            model.activeCabinet().state.sel = item.i;
            model.activeCabinet().state.item = item.j;
            inspector.update();
            inspector.showPop(e, '#pop3');
            return;
        }
        inspector.hidePop();
        model.activeCabinet().state.sel = u.i;
        model.activeCabinet().state.item = -1;
        model.activeCabinet().state.divider = -1;
        model.activeCabinet().state.space = null;
        if (h.point) {
            inspector.selectSpaceAt(u.i, renderState.Gr.worldToLocal(h.point.clone()));
        }
        selectionState.deep = true;
        selectionState.pillOn = true;
        inspector.update();
    }
    function hover(e) {
        const m = inspector.inside() ? picking.cast(e, renderState.ihits) : null, h = m ? m.object : null, i = h ? -1 : inspector.inside() ? picking.hitAt(e) : -1;
        renderState.outs.forEach((o, j) => {
            o.visible = j === i && (!selectionState.focusOn || j !== model.activeCabinet().state.sel);
            if (o.userData.label) {
                o.userData.label.dataset.active = String(j === i);
            }
        });
        renderState.ihits.forEach(x => {
            const o = x.userData.o;
            if (!o) {
                return;
            }
            o.visible = x === h || !!o.userData.s;
        });
        resources.cv.style.cursor = h || i >= 0 || picking.cast(e, renderState.allHits) ? 'pointer' : 'grab';
    }
    return { pick, hover };
}
