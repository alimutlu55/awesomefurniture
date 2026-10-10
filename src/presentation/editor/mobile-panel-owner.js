import { dropdowns } from './editor-dom.js';
import { dismissMobileSheetExits } from './mobile-sheet-motion.js';
/** Every mobile panel takes ownership of the same bottom editing surface. */
/** @param {ReturnType<typeof import('./editor-dom.js').createEditorDom>} dom
 * @param {HTMLElement} panel */
export function takeMobilePanel(dom, panel) {
    if (dom.width > 900) return;
    const { $ } = dom, app = $('#app');
    for (const id of ['#pop2','#pop3','#pop4']) {
        const other = $(id);
        if (other !== panel) other.classList.remove('show');
    }
    if (panel !== $('#left')) app.classList.remove('props-open');
    app.classList.remove('inspecting','adding');
    for (const [trigger, id] of dropdowns) {
        const other = $('#' + id);
        if (other === panel) continue;
        other.hidden = true;
        $('#' + trigger).setAttribute('aria-expanded','false');
    }
    if (panel !== $('#wizard') && !$('#wizard').hidden) $('#close-wizard').click();
    dismissMobileSheetExits(app.getRootNode());
}
