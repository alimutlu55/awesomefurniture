/** The Auto design wizard and the empty-scene prompt.
 * Event bindings only: each binder reads controls and calls commands or presenters it is given. */
/** @param {import('./wizard.ports').BindEmptySceneDismissPorts} ports */
export function bindEmptySceneDismiss({ dom, plannerState }) {
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
/** @param {import('./wizard.ports').BindEmptySceneLaunchPorts} ports */
export function bindEmptySceneLaunch({ dom, planner }) {
    const { $ } = dom;
    $('#empty-launch').onclick = planner.openWizard;
}
/** @param {import('./wizard.ports').BindCloseWizardPorts} ports */
export function bindCloseWizard({ dom, planner }) {
    const { $ } = dom;
    $('#close-wizard').onclick = planner.closeWizard;
}
/** @param {import('./wizard.ports').BindWizardInputsPorts} ports */
export function bindWizardInputs({ dom, planner, lifetime }) {
    const { $ } = dom;
    $('#wizard').querySelectorAll('input,select').forEach(el => {
        lifetime.listen(el, 'input', planner.markIdeasDirty);
        lifetime.listen(el, 'change', planner.markIdeasDirty);
    });
}
/** @param {import('./wizard.ports').BindIdeaApplyPorts} ports */
export function bindIdeaApply({ dom, planner, shell, plannerState, geometry, commands }) {
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
/** @param {import('./wizard.ports').BindWizardBackdropClosePorts} ports */
export function bindWizardBackdropClose({ dom, planner, lifetime }) {
    const { $ } = dom;
    lifetime.listen($('#wizard'), 'click', e => {
        if (e.target === $('#wizard')) {
            planner.closeWizard();
        }
    });
}
/** @param {import('./wizard.ports').BindWizardFocusTrapPorts} ports */
export function bindWizardFocusTrap({ dom, lifetime }) {
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
