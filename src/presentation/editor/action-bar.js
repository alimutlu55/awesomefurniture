import { ibIcon } from './editor-format.js';
/** The existing item toolbar, shared by item and wardrobe selections.
 * @param {Pick<Document, 'createElement'>} document
 * @param {string} label
 * @param {Array<{key:string;title:string;button?:HTMLButtonElement;disabled?:boolean}>} actions
 */
export function createActionBar(document, label, actions) {
    const bar = document.createElement('div');
    bar.className = 'selection-action-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', label);
    for (const action of actions) {
        const button = action.button || document.createElement('button');
        button.type = 'button';
        button.dataset.ib = action.key;
        button.classList.toggle('dl', action.key === 'del');
        button.title = action.title;
        button.setAttribute('aria-label', action.title);
        button.disabled = !!action.disabled;
        button.innerHTML = ibIcon(action.key) + (action.key === 'rot' ? '<span></span>' : '');
        bar.appendChild(button);
    }
    return bar;
}
