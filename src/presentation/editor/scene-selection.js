/** @param {Pick<import('./editor-gestures.ports').CreateEditorGesturesPorts, 'dom' | 'picking' | 'renderState' | 'inspector' | 'selectionState' | 'model' | 'resources' | 'camera' | 'room'>} ports */
export function createSceneSelection({ dom, picking, renderState, inspector, selectionState, model, resources, camera, room }) {
    /** The wall or opening under the pointer, when no wardrobe is in front of it. */
    const roomHit = (e, wardrobe) => {
        const hit = room ? picking.cast(e, room.pickables()) : undefined;
        return hit && (!wardrobe || hit.distance < wardrobe.distance) ? hit : undefined;
    };
    /** A point in the frame of the wardrobe the hit object belongs to. */
    const inWardrobe = (object, point) => {
        let group = object;
        while (group && !renderState.wardrobeGroups.includes(group)) group = group.parent;
        return group ? group.worldToLocal(point.clone()) : null;
    };
    function pick(e) {
        const studioMode = selectionState.viewMode === 'studio';
        const h = studioMode ? null : picking.cast(e, renderState.allHits);
        const part = selectionState.viewMode === 'wardrobe' ? null : roomHit(e, h);
        if (part && room.pick(part)) return;
        // A click anywhere else leaves the room part it had selected.
        selectionState.room = null;
        if (!h) {
            inspector.clearFocus();
            selectionState.pendingStudioAction = null;
            if (selectionState.viewMode === 'wardrobe') camera.frameWardrobe(); else camera.frameScene();
            return;
        }
        const u = h.object.userData;
        // Decide the selection scope before switching cabinet or rebuilding its hit boxes.
        if (!selectionState.focusOn || u.wardrobe !== model.scene.activeWardrobe) {
            // Where it was tapped is the space the person means, not the section's top: Add item ranks for it.
            const at = h.point ? inWardrobe(h.object, h.point) : null;
            inspector.selectCabinet(u.wardrobe);
            model.activeCabinet().state.sel = u.i;
            model.activeCabinet().state.space = null;
            if (at) inspector.selectSpaceAt(u.i, at);
            inspector.update();
            return;
        }
        const m = picking.cast(e, renderState.allItemHits);
        if (m && m.object.userData.wardrobe === model.scene.activeWardrobe) {
            // A selection replaces the open editing surface instead of leaving stale content.
            const app = dom.$('#app');
            const replacePanel = dom.width > 900 || app.matches('.props-open,.inspecting,.auto-design-open') || !!app.querySelector('.mobile-bottom-sheet.show,.dd:not([hidden])');
            const item = m.object.userData;
            if (item.divider !== undefined) {
                model.activeCabinet().state.divider = item.divider;
                model.activeCabinet().state.sel = item.i;
                model.activeCabinet().state.item = -1;
                selectionState.deep = true;
                selectionState.pillOn = false;
                inspector.update();
                if (replacePanel) inspector.showPop(e, '#pop4');
                else camera.frameMobileInspector(true);
                return;
            }
            model.activeCabinet().state.divider = -1;
            selectionState.deep = true;
            selectionState.pillOn = false;
            model.activeCabinet().state.sel = item.i;
            model.activeCabinet().state.item = item.j;
            inspector.update();
            if (replacePanel) inspector.showPop(e, '#pop3');
            else camera.frameMobileInspector(true);
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
        if (selectionState.viewMode === 'studio') {
            renderState.outs.forEach(o => { o.visible = false; });
            resources.cv.style.cursor = roomHit(e, null) ? 'pointer' : 'grab';
            return;
        }
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
        const wardrobe = h || i >= 0 ? null : picking.cast(e, renderState.allHits);
        resources.cv.style.cursor = h || i >= 0 || wardrobe || (selectionState.viewMode !== 'wardrobe' && roomHit(e, wardrobe)) ? 'pointer' : 'grab';
    }
    return { pick, hover };
}
