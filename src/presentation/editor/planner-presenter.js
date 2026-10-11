import { takeMobilePanel } from './mobile-panel-owner.js';
import { animateMobileSheetClose } from './mobile-sheet-motion.js';
import { PANEL, PLINTH, PURPOSE, purposeName, itemName, r1 } from '../../domain/wardrobe/catalog.js';
import { esc, zoneColor, zoneText } from './editor-format.js';
import { tags, issueTags } from './storage-tags.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { POSSESSION_KEYS, possession } from '../../domain/wardrobe/possessions';
/** wizard presentation behavior; the view ports provide transient UI state and application commands. */
/** @param {import('./planner-presenter.ports').CreatePlannerPresenterPorts} ports */
export function createPlannerPresenter({ dom, inspector, shell, plannerState, geometry, model, commands, plannerService, lifetime }) {
    const { $, document } = dom;
    const planned = k => Math.ceil((model.activeCabinet().state.profile.needs[k] || 0) * (1 + (model.activeCabinet().state.profile.growth ?? 15) / 100) - 1e-9);
    function miniPlan(p) {
        const H = geometry.ih(), reach = model.activeCabinet().state.profile.reach;
        const previewHeight = Math.max(300, Math.min(420, H * 1.5));
        return '<div class="mini-plan" style="height:'+previewHeight+'px" role="img" aria-label="'+esc(p.sections.map(s=>s.role).join('; '))+'">'+p.sections.map((s,i)=>{
            const positions=WardrobePlanner.layoutSection(s.items,s.width);
            const zones=s.items.map((it,j)=>{
                const q=positions[j];
                const access = WardrobePlanner.accessInfo(it, q.y0 + PLINTH + PANEL, model.activeCabinet().state.profile);
                const high = access.type === 'occasional' && access.aboveReach;
                const label = high ? (it.k === 'seasonal' ? 'High boxes' : 'High storage') : it.purpose === 'small' ? 'Socks' : zoneText(it);
                const detail = purposeName(it)+' · '+itemName(it)+' · Height '+r1(it.h)+' cm · '+access.label;
                return '<div class="mini-zone" title="'+esc(detail)+'" aria-label="'+esc(detail)+'" style="position:absolute;box-sizing:border-box;min-height:0;border-top:1px solid #ffffff80;left:'+q.x0/s.width*100+'%;bottom:'+q.y0/H*100+'%;width:'+q.w/s.width*100+'%;height:'+q.h/H*100+'%;background:'+zoneColor(it)+'"><span>'+esc(label)+' · '+r1(it.h)+' cm</span></div>';
            }).join('');
            const boards=(p.dividers||[]).filter(d=>d.i===i).map(d=>{
                const horizontal=d.orientation==='horizontal',x=horizontal?d.x0:d.x-PANEL/2,y=horizontal?d.y-PANEL/2:d.y0,w=horizontal?d.x1-d.x0:PANEL,h=horizontal?PANEL:d.y1-d.y0;
                return '<div aria-hidden="true" style="position:absolute;left:'+x/s.width*100+'%;bottom:'+y/H*100+'%;width:'+w/s.width*100+'%;height:'+h/H*100+'%;background:var(--line)"></div>';
            }).join('');
            return '<div class="mini-bay" style="flex:'+s.width+'">'+zones+boards+'<div class="mini-reach" style="bottom:'+Math.max(0,Math.min(100,(reach-PLINTH-PANEL)/H*100))+'%">'+(i===0?'<span>'+reach+' cm</span>':'')+'</div></div>';
        }).join('')+'</div><div class="mini-widths">'+p.sections.map(s=>'<span style="flex:'+s.width+'">'+s.width.toFixed(1)+' cm</span>').join('')+'</div>';
    }
    function renderIdeas() {
        const cfg = geometry.plannerConfig();
        const tag = (text, tone = '') => '<span class="pill '+tone+'">'+esc(text)+'</span>';
        $('#ideas-note').innerHTML = '';
        $('#ideas-note').hidden = true;
        $('#wizard-size').textContent = model.activeCabinet().state.w + ' × ' + model.activeCabinet().state.h + ' × ' + model.activeCabinet().state.d + ' cm';
        $('#ideas-count').textContent = plannerState.ideas.length + ' designs';
        $('#ideas').innerHTML = plannerState.ideas.length ? plannerState.ideas.map((p, index) => {
            const m = p.metrics;
            const requested = POSSESSION_KEYS.filter(k => cfg.needs[k] > 0);
            const owned = requested.reduce((sum, k) => sum + cfg.needs[k], 0);
            const currentFit = owned ? requested.reduce((sum, k) => sum + Math.min(cfg.needs[k], Math.floor(m.capacities[k])), 0) / owned : 1;
            const shortages = requested.filter(k => Math.floor(m.capacities[k]) < cfg.needs[k]);
            const tags = [tag(Math.floor(currentFit*100)+'% of items fit', shortages.length?'warn':'good')];
            for (const k of shortages) tags.push(tag(PURPOSE[k]+': '+(cfg.needs[k]-Math.floor(m.capacities[k]))+" won't fit",'warn'));
            return '<article class="idea '+(index===0?'best':'')+'">'+miniPlan(p)+'<div class="idea-text"><h4><span>#'+(index+1)+' '+esc(p.title)+'</span></h4><div class="meta">'+tags.join('')+'</div><div class="capacity"><span>Storage</span><b>Fits / Owned</b>'+requested.map(k=>{
                const have=Math.floor(m.capacities[k]),need=cfg.needs[k],cls=have<need?' class="low"':'';
                return '<span'+cls+'>'+esc(PURPOSE[k])+'</span><b'+cls+'>'+have+' / '+need+'</b>';
            }).join('')+'</div><button class="apply" data-idea="'+index+'">Use this layout</button></div></article>';
        }).join('') : tag(Object.values(cfg.needs).some(n=>Number(n)>0)?'No fitting layout':'Add possessions','warn');
    }
    function syncPreferences(preserveEditing = false) {
        const p = model.activeCabinet().state.profile;
        const syncValue = (selector, value) => {
            const input = /** @type {HTMLInputElement} */ ($(selector));
            if (preserveEditing && document?.activeElement === input) return;
            const next = String(value);
            if (input.value !== next) input.value = next;
        };
        for (const k of Object.keys(p.needs)) {
            syncValue('#need-' + k, p.needs[k]);
        }
        syncValue('#jackets', p.jackets ?? 0);
        syncValue('#coats', p.coats ?? 0);
        syncValue('#reach', p.reachStd ?? p.reach ?? 185);
        $('#reach').disabled = !!p.accessible;
        $('#reach-value').textContent = p.reach + ' cm' + (p.accessible ? ' · seated' : '');
        WardrobePlanner.configure(p);
    }
    function readPreferences() {
        const bounded = (id, min, max, fallback) => {
            const v = Number($(id).value);
            return Math.max(min, Math.min(max, Number.isFinite(v) && $(id).value !== '' ? Math.round(v) : fallback));
        };
        const needs = { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0 };
        for (const k of Object.keys(model.activeCabinet().state.profile.needs)) {
            needs[k] = bounded('#need-' + k, 0, possession(k)?.need.max ?? 80, model.activeCabinet().state.profile.needs[k] ?? 0);
        }
        const p = model.activeCabinet().state.profile;
        const reachStd = bounded('#reach', 140, 210, p.reachStd ?? p.reach ?? 185);
        return { ...p, reach: p.accessible ? 122 : reachStd, reachStd, needs, jackets: bounded('#jackets', 0, needs.short, 0), coats: bounded('#coats', 0, needs.long, 0), engaged: true };
    }
    function refreshIdeas(read = false) {
        lifetime.cancelTimeout(plannerState.ideasTimer);
        plannerState.ideasTimer = null;
        if (read) {
            commands.setPreferences(readPreferences());
            syncPreferences(true);
        }
        plannerState.ideas = plannerService.generate(geometry.plannerConfig());
        plannerState.ideasConfig = JSON.stringify({ ...geometry.plannerConfig(), engaged: 0 });
        renderIdeas();
        $('#ideas').setAttribute('aria-busy', 'false');
    }
    function openWizard() {
        shell.closeDD();
        plannerState.wizardTrigger = document.activeElement;
        inspector.hidePop();
        if (dom.width <= 900) $('#app').classList.remove('props-open');
        takeMobilePanel(dom, $('#wizard'));
        syncPreferences();
        const sheet = /** @type {HTMLElement | null} */ ($('#wizard').querySelector('.wizard-shell'));
        if (sheet) sheet.dataset.sheetPosition = 'full';
        $('#wizard').hidden = false;
        $('#app').classList.add('auto-design-open');
        $('#app').inert = true;
        if (plannerService.has(geometry.plannerConfig())) {
            refreshIdeas();
        }
        else {
            $('#ideas-count').textContent = 'Calculating layouts…';
            $('#ideas').setAttribute('aria-busy', 'true');
            $('#ideas').querySelectorAll('[data-idea]').forEach(b => ( /** @type {HTMLInputElement} */(b)).disabled = true);
            lifetime.cancelFrame(plannerState.openRaf);
            lifetime.cancelTimeout(plannerState.openTimer);
            // Wait for one paint so the wizard appears straight away, then compute. A pending edit timer will do its own refresh.
            plannerState.openRaf = lifetime.frame(() => {
                plannerState.openTimer = lifetime.timeout(() => {
                    plannerState.openTimer = null;
                    if (!$('#wizard').hidden && plannerState.ideasTimer === null) {
                        refreshIdeas();
                    }
                }, 0);
            });
        }
        $('#close-wizard').focus();
    }
    function closeWizard() {
        lifetime.cancelFrame(plannerState.openRaf);
        lifetime.cancelTimeout(plannerState.openTimer);
        plannerState.openTimer = null;
        if (plannerState.ideasTimer !== null) {
            lifetime.cancelTimeout(plannerState.ideasTimer);
            plannerState.ideasTimer = null;
            commands.setPreferences(readPreferences());
        }
        animateMobileSheetClose($('#wizard').querySelector('.wizard-shell'));
        $('#wizard').hidden = true;
        $('#app').classList.remove('auto-design-open');
        $('#app').inert = false;
        (plannerState.wizardTrigger || $('#launch-wizard')).focus();
    }
    function storedNow(a) {
        const rows = /** @type {[string, number][]} */ (POSSESSION_KEYS.map(k => [PURPOSE[k], Math.floor(a.capacities[k] ?? 0)])).concat([['Seasonal boxes', Math.floor(a.capacities.seasonalBoxes)]]).filter(r => r[1] > 0);
        return (rows.length ? '<div class="capacity">' + rows.map(r => '<span>' + esc(r[0]) + '</span><b>~' + r[1] + '</b>').join('') + '</div>' + tags(['Current capacity']) : tags(['Empty', 'Add fittings']));
    }
    function planUI(a) {
        $('#empty-scene').hidden = geometry.stats().mods > 0 || plannerState.emptyDismissed;
        $('#plan-title').textContent = model.activeCabinet().state.proposal?.title || (geometry.stats().mods ? 'Custom wardrobe' : 'Make it yours');
        const profile = model.activeCabinet().state.profile;
        const requested = Object.keys(profile.needs).filter(k => profile.needs[k] > 0);
        $('#plan-summary').innerHTML = profile.engaged ? tags([requested.every(k => a.capacities[k] >= profile.needs[k]) ? 'All items fit' : 'Some items won’t fit']) : '';
        $('#plan-summary').hidden = !profile.engaged;
        $('#plan-capacity').innerHTML = !model.activeCabinet().state.profile.engaged ? storedNow(a) : '<div class="capacity">' + Object.keys(model.activeCabinet().state.profile.needs).filter(k => model.activeCabinet().state.profile.needs[k] > 0).map(k => {
            const have = Math.floor(a.capacities[k]), need = profile.needs[k], cls = have < 1 ? ' class="none"' : have < need ? ' class="low"' : '';
            return '<span' + cls + '>' + esc(PURPOSE[k]) + '</span><b' + cls + '>~' + have + ' / ' + need + '</b><div class="bar"><i style="width:' + Math.min(100, (need ? have / need : 1) * 100) + '%"></i></div>';
        }).join('') + '</div>' + tags(['Fits / Owned']);
        const eng = model.activeCabinet().state.profile.engaged, issues = [...a.errors, ...a.warnings.filter(x => !/^(Occasional storage|Pull-down access)/.test(x) && (eng || !x.startsWith('Seasonal storage:')))];
        {
            const nIssues = new Set(issues).size, fw = $('#fit-warn');
            fw.hidden = !nIssues;
            fw.textContent = String(nIssues);
            fw.title = nIssues + (nIssues === 1 ? ' note' : ' notes');
        }
        $('#plan-warnings').innerHTML = [...new Set(issues)].map(x => tags([issueTags(x).join(' · ')], 'warn')).join('');
    }
    /** A settings change makes the current ideas stale. While the reach slider is being dragged only its
     * label moves; ideas are recalculated once, when the user lets go (the change event). */
    function markIdeasDirty(event) {
        if ($('#wizard').hidden) {
            return;
        }
        lifetime.cancelTimeout(plannerState.ideasTimer);
        const p = model.activeCabinet().state.profile;
        const reach = readPreferences().reach;
        $('#reach-value').textContent = reach + ' cm' + (p.accessible ? ' · seated' : '');
        if (event?.type === 'input' && /** @type {HTMLInputElement} */ (event.target).type === 'range') {
            plannerState.ideasTimer = null;
            return;
        }
        $('#ideas-count').textContent = 'Settings changed · updating';
        $('#ideas').setAttribute('aria-busy', 'true');
        $('#ideas').querySelectorAll('[data-idea]').forEach(b => ( /** @type {HTMLInputElement} */(b)).disabled = true);
        plannerState.ideasTimer = lifetime.timeout(() => refreshIdeas(true), 350);
    }
    return { miniPlan, renderIdeas, syncPreferences, readPreferences, refreshIdeas, openWizard, closeWizard, storedNow, planUI, markIdeasDirty, planned };
}
