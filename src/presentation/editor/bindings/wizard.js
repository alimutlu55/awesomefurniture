/** The Auto design wizard and the empty-scene prompt.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./wizard.ports').BindEmptyXPorts} ports */
export function bindEmptyX({ dom, plannerState }) {
    const { $ } = dom;
    $('#empty-x').onclick = () => {
        plannerState.emptyDismissed = true;
        $('#empty-scene').hidden = true;
    };
}
/** @param {import('./wizard.ports').BindLaunchWizardPorts} ports */
export function bindLaunchWizard({ dom, planner }) {
    const { $ } = dom;
    $('#launch-wizard').onclick = planner.openWizard;
}
/** @param {import('./wizard.ports').BindEmptyLaunchPorts} ports */
export function bindEmptyLaunch({ dom, planner }) {
    const { $ } = dom;
    $('#empty-launch').onclick = planner.openWizard;
}
/** @param {import('./wizard.ports').BindCloseWizardPorts} ports */
export function bindCloseWizard({ dom, planner }) {
    const { $ } = dom;
    $('#close-wizard').onclick = planner.closeWizard;
}
/** @param {import('./wizard.ports').BindWizardPorts} ports */
export function bindWizard({ dom, planner, lifetime }) {
    const { $ } = dom;
    $('#wizard').querySelectorAll('input,select').forEach(el => {
        lifetime.listen(el, 'input', planner.markIdeasDirty);
        lifetime.listen(el, 'change', planner.markIdeasDirty);
    });
}
/** @param {import('./wizard.ports').BindIdeasPorts} ports */
export function bindIdeas({ dom, planner, shell, plannerState, geometry, commands }) {
    const { $ } = dom;
    $('#ideas').onclick = e => {
        const b = ( /** @type {HTMLElement} */(e.target)).closest(dom.selector('[data-idea]'));
        if (!b) {
            return;
        }
        if (plannerState.ideasConfig !== JSON.stringify({ ...geometry.plannerConfig(), ...planner.readPreferences(), engaged: 0 })) {
            planner.refreshIdeas(true);
            shell.toast('Setup changed. Choose from the refreshed ideas.');
            return;
        }
        commands.applyProposal(plannerState.ideas[+( /** @type {HTMLElement} */(b)).dataset.idea]);
        planner.closeWizard();
    };
}
/** @param {import('./wizard.ports').BindWizard2Ports} ports */
export function bindWizard2({ dom, planner, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wizard'), 'click', e => {
        if (e.target === $('#wizard')) {
            planner.closeWizard();
        }
    });
}
/** @param {import('./wizard.ports').BindWizard3Ports} ports */
export function bindWizard3({ dom, lifetime }) {
    const { $, document } = dom;
    lifetime.listen($('#wizard'), 'keydown', e => {
        if (e.key !== 'Tab') {
            return;
        }
        const focusable = [...$('#wizard').querySelectorAll('button,input,select,a,summary')].filter(el => !( /** @type {HTMLInputElement} */(el)).disabled && el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            ( /** @type {HTMLElement} */(last)).focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            ( /** @type {HTMLElement} */(first)).focus();
        }
    });
}
