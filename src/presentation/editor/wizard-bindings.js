/** DOM event bindings call application commands through the mounted view ports. */
/** @param {import('./wizard-bindings.ports').BindPlanCapacityPorts} ports */
export function bindPlanCapacity({ dom, planner, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#plan-capacity'), 'click', e => {
        if (e.target.closest(dom.selector('[data-needs]'))) {
            planner.openWizard();
        }
    });
}
