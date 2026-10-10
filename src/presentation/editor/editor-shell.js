import { dropdowns } from './editor-dom.js';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./editor-shell.ports').CreateEditorShellPorts} ports */
export function createEditorShell({ dom, shellState, geometry, model, lifetime, elements }) {
    const { $, document } = dom;
    const sync = () => {
        const on = !!document.querySelector('.pop.show');
        $('#more-btn').setAttribute('aria-expanded', String($('#pop2').classList.contains('show')));
        elements.app.classList.toggle('inspecting', on);
        elements.app.classList.toggle('adding', $('#pop2').classList.contains('show'));
        if (on) {
            elements.app.classList.remove('props-open');
            if (dom.width > 900 && document.querySelector('#left .pop.show')) elements.app.classList.remove('props-hidden');
        }
        const visible = !elements.app.classList.contains('props-hidden') && (dom.width > 900 || elements.app.classList.contains('props-open'));
        const label = visible ? 'Hide settings' : 'Show settings';
        elements.propsButton.setAttribute('aria-pressed', String(visible));
        elements.propsButton.setAttribute('aria-expanded', String(visible));
        elements.propsButton.setAttribute('aria-label', label);
        elements.propsButton.setAttribute('data-tip', label);
    };
    /** @type {Array<[string, string, string, number, (stats: any) => boolean]>} */
    const Q = [['first', 'First Fit', 'Add any module', 50, s => s.mods > 0], ['hang', 'Hang Tight', 'Add a hanging rail', 50, s => s.hang > 0], ['drw', 'Drawer Duty', 'Have 3+ drawers', 75, s => s.drawers >= 3],
        ['shoe', 'Sole Mate', 'Add a shoe rack', 50, s => s.shoe > 0], ['tall', 'Tall Order', 'Make it 240 cm tall', 60, s => model.activeCabinet().state.h >= 240], ['door', 'Door Dandy', 'Add doors', 40, s => model.activeCabinet().state.doors !== 'none'], ['cut', 'Tailor-made', 'Resize a section by hand', 60, () => !!shellState.G.cut], ['tune', 'Fine Tuner', 'Resize an item by hand', 60, () => !!shellState.G.tune], ['paint', 'Odd One Out', 'Give an item its own finish', 60, () => !!shellState.G.paint],
        ['full', 'Tetris Master', 'Fill a section to 95%+', 100, s => s.maxFill >= .95],
        ['speed', 'Speed Builder', '3 quests in under 2 minutes', 150, s => Object.keys(shellState.G.done).length >= 3 && Date.now() - shellState.t0 < 12e4]];
    // Notifications are disabled; Undo remains available in the editor toolbar.
    function toast(_message, _action) {}
    function burst() {
        return;
        const v = $('#view');
        for (let i = 0; i < 22; i++) {
            const s = document.createElement('span');
            s.className = 'pt';
            s.textContent = ['✨', '⭐', '🎉'][i % 3];
            v.appendChild(s);
            s.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(Math.random() - .5) * 500}px,${-120 - Math.random() * 320}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
        }
    }
    function check() {
        const s = geometry.stats();
        Q.forEach(q => {
            if (!shellState.G.done[q[0]] && q[4](s)) {
                shellState.G.done[q[0]] = 1;
                shellState.G.xp += q[3]; /* quest rewards silenced */
            }
        });
    }
    function closeDD(except) {
        let any = false;
        for (const [b, p] of dropdowns) {
            const pe = document.getElementById(p);
            if (p === except) {
                continue;
            }
            if (!pe.hidden) {
                any = true;
            }
            pe.hidden = true;
            document.getElementById(b).setAttribute('aria-expanded', 'false');
        }
        return any;
    }
    function openDD(btn, panel) {
        const pe = document.getElementById(panel);
        closeDD(panel);
        pe.hidden = !pe.hidden;
        document.getElementById(btn).setAttribute('aria-expanded', String(!pe.hidden));
    }
    return { toast, burst, check, closeDD, openDD, sync, Q };
}
