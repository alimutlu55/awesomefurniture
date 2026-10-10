import type { MountEditorBindingsPorts } from './mount-editor-bindings.ports';

type Ports = Pick<MountEditorBindingsPorts, 'dom' | 'camera' | 'cameraState' | 'inspector' | 'selectionState' | 'model' | 'lifetime' | 'interactions' | 'planner'>;
type Mode = 'settings' | 'resize' | 'sections' | 'reach' | 'finish' | 'doors' | 'manage' | 'wardrobe-select' | 'wardrobe-add' | 'wardrobe-reset' | 'wardrobe-remove' | 'place' | 'rotate' | 'add' | 'item' | 'item-resize' | 'item-finish' | 'item-align' | 'item-purpose' | 'item-move' | 'item-swap' | 'item-measure' | 'item-type' | 'item-duplicate' | 'item-delete' | 'divider' | 'divider-move' | 'divider-measure' | 'divider-duplicate' | 'divider-remove' | 'storage' | 'menu' | 'help' | 'auto-design';

/** Mobile actions share a viewport, navigation stack and reversible DOM moves.
 * The desktop controls and their command bindings keep their original homes. */
export function bindMobileFocus({ dom, camera, cameraState, inspector, selectionState, model, lifetime, interactions, planner }: Ports) {
    const { $ } = dom;
    const app = $('#app'), native = app.ownerDocument;
    const desktop = dom.matchMedia('(min-width:901px)');
    const controls = native.createElement('section');
    controls.className = 'mobile-focus-controls';
    controls.hidden = true;
    controls.setAttribute('aria-label', 'Action controls');
    const header = native.createElement('header'), back = native.createElement('button'), title = native.createElement('h2'), body = native.createElement('div');
    back.type = 'button'; back.textContent = '‹ Back'; back.className = 'mobile-focus-back';
    body.className = 'mobile-focus-body';
    header.append(back, title); controls.append(header, body); app.append(controls);
    const names: Record<Mode, string> = { settings: 'Wardrobe actions', resize: 'Resize wardrobe', sections: 'Sections', reach: 'Reach guide', finish: 'Wardrobe finish', doors: 'Doors', manage: 'Wardrobes', 'wardrobe-select': 'Select wardrobe', 'wardrobe-add': 'Add wardrobe', 'wardrobe-reset': 'Reset wardrobe', 'wardrobe-remove': 'Remove wardrobe', place: 'Move wardrobe', rotate: 'Rotate wardrobe', add: 'Add to this space', item: 'Item actions', 'item-resize': 'Resize item', 'item-finish': 'Item finish', 'item-align': 'Align item', 'item-purpose': 'Stores', 'item-move': 'Move item', 'item-swap': 'Swap item', 'item-measure': 'Measurements', 'item-type': 'Change item type', 'item-duplicate': 'Duplicate item', 'item-delete': 'Remove item', divider: 'Divider actions', 'divider-move': 'Move divider', 'divider-measure': 'Divider measurements', 'divider-duplicate': 'Duplicate divider', 'divider-remove': 'Remove divider', storage: 'Storage & fit', menu: 'Menu', help: 'Help', 'auto-design': 'Auto design' };
    const settings: Mode[] = ['resize', 'sections', 'reach', 'finish', 'doors', 'place', 'rotate', 'manage'];
    const item: Mode[] = ['item-resize', 'item-align', 'item-purpose', 'item-finish', 'item-move', 'item-swap', 'item-type', 'item-measure', 'item-duplicate', 'item-delete'];
    const manage: Mode[] = ['wardrobe-select','wardrobe-add','wardrobe-reset','wardrobe-remove'];
    const divider: Mode[] = ['divider-move', 'divider-measure', 'divider-duplicate', 'divider-remove'];
    const nodes: Partial<Record<Mode, HTMLElement[]>> = {
        resize: [$('#sliders')], sections: [$('#section-row')], reach: [$('#left').querySelector<HTMLElement>('.reach-row')!],
        finish: [$('#fins')], doors: [$('#left').querySelector<HTMLElement>('.door-grid')!],
        'wardrobe-select': [$('#wardrobe-select')],
        add: [$('#pop2')], 'item-resize': [$('#pop3').querySelector<HTMLElement>('.item-size-pair')!],
        'item-align': [$('#ialign')], 'item-purpose': [$('#ipurpose')], 'item-finish': [$('#ifin')],
        'item-move': [$('#move-controls')], 'item-swap': [$('#move-controls')], 'item-measure': [$('#imeas')], 'item-type': [$('#itype')],
        'divider-move': [$('#pop4').querySelector<HTMLElement>('.item-size-pair')!], 'divider-measure': [$('#dmeas')],
        storage: [$('#plan-panel')], menu: [$('#menu')], help: [$('#help-panel')],
        'auto-design': [$('#wizard').querySelector<HTMLElement>('.wizard-shell')!]
    };
    const capture = () => ({
        pose: camera.camNow(), shift: cameraState.vs, zoom: cameraState.vz, initial: cameraState.initialCameraFraming,
        wardrobe: model.scene.activeWardrobe,
        selection: { sel: model.activeCabinet().state.sel, item: model.activeCabinet().state.item, divider: model.activeCabinet().state.divider, space: structuredClone(model.activeCabinet().state.space) },
        flags: { focusOn: selectionState.focusOn, deep: selectionState.deep, pillOn: selectionState.pillOn },
        scrolls: [...dom.root.querySelectorAll<HTMLElement>('aside,.pop')].map(el => [el, el.scrollTop] as const),
        trigger: dom.root instanceof ShadowRoot ? dom.root.activeElement as HTMLElement | null : native.activeElement as HTMLElement | null
    });
    let saved: ReturnType<typeof capture> | null = null, pending: ReturnType<typeof capture> | null = null;
    let commandBefore: string | null = null;
    const returns: Array<{ pose: ReturnType<typeof camera.camNow>; shift: number; zoom: number; scroll: number }> = [];
    let stack: Mode[] = [], moved: Array<{ node: HTMLElement; marker: Comment; hidden: HTMLElement['hidden'] }> = [], guard = false;
    let frame = 0;
    const restoreNodes = () => {
        for (const { node, marker, hidden } of moved) {
            marker.replaceWith(node); node.classList.remove('focus-content'); node.hidden = hidden;
        }
        moved = []; body.replaceChildren();
    };
    const frameTarget = () => {
        lifetime.cancelFrame(frame);
        frame = lifetime.frame(() => {
            if (!stack.length || desktop.matches) return;
            camera.resize();
            const mode = stack.at(-1)!;
            if (['settings', 'resize', 'sections', 'reach', 'finish', 'doors', 'manage', 'place', 'rotate', 'storage', 'menu', 'help', 'auto-design', 'item-move', 'item-swap'].includes(mode) || mode.startsWith('wardrobe-')) {
                camera.camRelease();
                camera.cameraTransition(camera.camFront(), 360);
            } else camera.focusSelection();
            cameraState.vs = cameraState.vsT = 0;
            cameraState.vz = cameraState.vzT = 1;
        });
    };
    const draw = () => {
        restoreNodes();
        const mode = stack.at(-1)!;
        app.dataset.focusMode = mode; title.textContent = names[mode];
        controls.hidden = false; app.classList.add('mobile-focus');
        if (mode === 'settings' || mode === 'item' || mode === 'divider' || mode === 'manage') {
            const menu = native.createElement('div'); menu.className = 'mobile-action-menu';
            for (const next of mode === 'settings' ? settings : mode === 'item' ? item : mode === 'manage' ? manage : divider) {
                const button = native.createElement('button'); button.type = 'button'; button.textContent = names[next];
                button.dataset.focusAction = next; menu.append(button);
            }
            body.append(menu);
        } else if (mode === 'place' || mode === 'rotate') {
            for (const key of mode === 'place' ? ['x','y','z'] : ['angle']) {
                const label = native.createElement('label'), input = native.createElement('input');
                label.textContent = ({x:'Left / right (cm)',y:'Up / down (cm)',z:'Forward / back (cm)',angle:'Angle (°)'} as Record<string,string>)[key]!;
                input.type = 'number'; input.inputMode = 'decimal'; input.step = key === 'angle' ? '5' : '1';
                input.value = String(model.activeCabinet()[key as 'x'|'y'|'z'|'angle']);
                input.addEventListener('change', () => { inspector.setCabinetPose(key,input.valueAsNumber); input.value = String(model.activeCabinet()[key as 'x'|'y'|'z'|'angle']); });
                label.append(input); body.append(label);
            }
        } else if (['item-duplicate','item-delete','divider-duplicate','divider-remove','wardrobe-add','wardrobe-reset','wardrobe-remove'].includes(mode)) {
            const button = native.createElement('button'); button.type = 'button'; button.textContent = names[mode];
            button.addEventListener('click', () => {
                if (mode === 'item-duplicate') inspector.itemAction('dup');
                else if (mode === 'item-delete') inspector.itemAction('del');
                else if (mode.startsWith('wardrobe-')) $(mode === 'wardrobe-add' ? '#wardrobe-add' : mode === 'wardrobe-reset' ? '#reset-all' : '#remove-wardrobe').click();
                else $(mode === 'divider-duplicate' ? '#divider-dup' : '#divider-remove').click();
                exit();
            }); body.append(button);
            if (mode === 'wardrobe-remove') button.disabled = model.scene.wardrobes.length < 2;
        } else for (const node of nodes[mode] ?? []) {
            const marker = native.createComment('mobile action control home'); node.before(marker);
            moved.push({ node, marker, hidden: node.hidden }); node.hidden = false; node.classList.add('focus-content'); body.append(node);
        }
        body.scrollTop = 0;
        frameTarget(); back.focus({ preventScroll: true });
    };
    const enter = (mode: Mode) => {
        if (desktop.matches) return;
        if (!saved) { saved = pending ?? capture(); pending = null; }
        else returns.push({pose:camera.camNow(),shift:cameraState.vs,zoom:cameraState.vz,scroll:body.scrollTop});
        guard = true;
        if (mode === 'auto-design') { planner.openWizard(); app.inert = false; }
        if (mode === 'settings') {
            inspector.hidePop(); model.activeCabinet().state.item = -1; model.activeCabinet().state.divider = -1;
            selectionState.deep = false; inspector.update(true);
        }
        if (mode === 'add') {
            model.activeCabinet().state.item = -1; model.activeCabinet().state.divider = -1;
            selectionState.deep = true; inspector.update(true); inspector.showPop(null, '#pop2');
        }
        stack.push(mode); draw(); guard = false;
    };
    const exit = () => {
        if (!saved) return;
        guard = true;
        const previous = saved; saved = null; pending = null; stack = []; returns.length = 0;
        lifetime.cancelFrame(frame); restoreNodes(); controls.hidden = true;
        if (stack.includes('auto-design') || !$('#wizard').hidden) planner.closeWizard();
        app.classList.remove('mobile-focus'); delete app.dataset.focusMode;
        interactions.cancelMovement(); inspector.hidePop();
        model.select(previous.wardrobe);
        Object.assign(model.activeCabinet().state, previous.selection);
        Object.assign(selectionState, previous.flags);
        inspector.update(true);
        camera.camRelease(); camera.cameraApply(previous.pose);
        cameraState.vs = cameraState.vsT = previous.shift; cameraState.vz = cameraState.vzT = previous.zoom;
        cameraState.initialCameraFraming = previous.initial; camera.resize();
        for (const [el, top] of previous.scrolls) el.scrollTop = top;
        previous.trigger?.focus({ preventScroll: true });
        guard = false;
    };
    const goBack = () => {
        if (stack.length > 1) {
            guard = true;
            if (stack.at(-1) === 'auto-design') planner.closeWizard();
            interactions.cancelMovement(); stack.pop(); draw();
            const previous = returns.pop();
            if (previous) {
                lifetime.cancelFrame(frame); camera.camRelease(); camera.cameraApply(previous.pose);
                cameraState.vs = cameraState.vsT = previous.shift; cameraState.vz = cameraState.vzT = previous.zoom;
                body.scrollTop = previous.scroll;
            }
            guard = false;
        } else exit();
    };
    lifetime.listen(back, 'click', goBack);
    lifetime.listen(body, 'click', (e: MouseEvent) => {
        const action = (e.target as HTMLElement).closest<HTMLElement>('[data-focus-action]')?.dataset.focusAction;
        if (action) enter(action as Mode);
        else if (stack[0] === 'add' && commandBefore !== null) {
            const changed = model.snapshot() !== commandBefore;
            commandBefore = null;
            if (changed) exit();
        }
    });
    lifetime.listen(dom.root, 'pointerdown', () => { if (!desktop.matches && !saved) pending = capture(); }, { capture: true });
    const passivePreview = (e: PointerEvent) => {
        // Action controls choose what can change; passive previews must not
        // accidentally start the editor's unrelated body-drag or selection.
        if (!desktop.matches && saved && !['item-move','item-swap'].includes(stack.at(-1)!)) e.stopImmediatePropagation();
    };
    for (const event of ['pointerdown','pointermove','pointerup']) lifetime.listen($('#c'), event, passivePreview, { capture: true });
    lifetime.listen(dom.root, 'click', (e: MouseEvent) => {
        if (desktop.matches) return;
        if (stack[0] === 'add' && (e.target as HTMLElement).closest('button[data-m],button[data-a]')) commandBefore = model.snapshot();
        const target = (e.target as HTMLElement).closest<HTMLElement>('[data-editor-id]');
        const id = target && dom.controlId(target);
        const triggers: Record<string,Mode> = {'props-btn':'settings','more-btn':'add','launch-wizard':'auto-design','empty-launch':'auto-design','fitchip':'storage','menu-btn':'menu','help-btn':'help','help-menu':'help'};
        if (id && triggers[id]) {
            e.preventDefault(); e.stopImmediatePropagation(); enter(triggers[id]);
        }
    }, { capture: true });
    lifetime.listen(dom.root, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && saved) { e.preventDefault(); e.stopImmediatePropagation(); goBack(); }
    }, { capture: true });
    lifetime.listen(dom.root, 'input', () => { if (stack.at(-1) === 'resize') frameTarget(); });
    const observer = new MutationObserver(() => {
        if (desktop.matches || guard) return;
        if (!$('#wizard').hidden && stack.at(-1) !== 'auto-design') { enter('auto-design'); return; }
        if ($('#wizard').hidden && stack.at(-1) === 'auto-design') { goBack(); return; }
        const active = ['pop2', 'pop3', 'pop4'].find(id => $('#' + id).classList.contains('show'));
        if (!saved && active) enter(active === 'pop2' ? 'add' : active === 'pop3' ? 'item' : 'divider');
        else if (saved && stack[0] === 'add' && !active) exit();
    });
    for (const id of ['#pop2', '#pop3', '#pop4']) lifetime.observe(observer, $(id), { attributes: true, attributeFilter: ['class'] });
    lifetime.observe(observer, $('#wizard'), { attributes: true, attributeFilter: ['hidden'] });
    lifetime.listen(desktop, 'change', () => { if (desktop.matches) exit(); });
    lifetime.cleanup(() => { lifetime.cancelFrame(frame); restoreNodes(); controls.remove(); });
    return { enter, exit };
}
