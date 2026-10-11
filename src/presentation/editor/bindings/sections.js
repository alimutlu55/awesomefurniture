/** Section count and the section diagram.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./sections.ports').BindSecMinusPorts} ports */
export function bindSecMinus({ dom, commands }) {
    const { $ } = dom;
    $('#sec-minus').onclick = () => commands.changeSections(-1);
}
/** @param {import('./sections.ports').BindSecPlusPorts} ports */
export function bindSecPlus({ dom, commands }) {
    const { $ } = dom;
    $('#sec-plus').onclick = () => commands.changeSections(1);
}
/** @param {import('./sections.ports').BindSectionDiagramPorts} ports */
export function bindSectionDiagram({ dom, inspector, model, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#section-diagram'), 'click', e => {
        const i = e.target.closest(dom.selector('[data-sec]'));
        if (!i) {
            return;
        }
        model.activeCabinet().state.sel = +i.dataset.sec;
        model.activeCabinet().state.item = -1;
        inspector.update();
    });
}
