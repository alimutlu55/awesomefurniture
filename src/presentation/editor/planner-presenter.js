import { PANEL, PLINTH, PURPOSE, purposeName, itemName, r1 } from '../../domain/wardrobe/catalog.js';
import { esc, zoneColor, zoneText, SHARED_NOTE } from './editor-format.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { noPlanExplanation } from '../../domain/planner/selection-planner';
/** wizard presentation behavior; the view ports provide transient UI state and application commands. */
/** @param {import('./planner-presenter.ports').CreatePlannerPresenterPorts} ports */
export function createPlannerPresenter({ dom, inspector, shell, plannerState, geometry, model, commands, plannerService, lifetime }) {
    const { $, document } = dom;
    const planned = k => Math.ceil((model.activeCabinet().state.profile.needs[k] || 0) * (1 + (model.activeCabinet().state.profile.growth ?? 15) / 100) - 1e-9);
    function miniPlan(p) {
        const H = geometry.ih(), reach = model.activeCabinet().state.profile.reach;
        return '<div class="mini-plan" role="img" aria-label="'+esc(p.sections.map(s=>s.role).join('; '))+'">'+p.sections.map((s,i)=>{
            const positions=WardrobePlanner.layoutSection(s.items,s.width);
            const zones=s.items.map((it,j)=>{
                const q=positions[j];
                return '<div class="mini-zone" title="'+esc(purposeName(it)+' · '+itemName(it)+' · '+r1(it.h)+' cm')+'" style="position:absolute;box-sizing:border-box;min-height:0;left:'+q.x0/s.width*100+'%;bottom:'+q.y0/H*100+'%;width:'+q.w/s.width*100+'%;height:'+q.h/H*100+'%;background:'+zoneColor(it)+'"><span>'+esc(zoneText(it))+'</span></div>';
            }).join('');
            const boards=(p.dividers||[]).filter(d=>d.i===i).map(d=>{
                const horizontal=d.orientation==='horizontal',x=horizontal?d.x0:d.x-PANEL/2,y=horizontal?d.y-PANEL/2:d.y0,w=horizontal?d.x1-d.x0:PANEL,h=horizontal?PANEL:d.y1-d.y0;
                return '<div aria-hidden="true" style="position:absolute;left:'+x/s.width*100+'%;bottom:'+y/H*100+'%;width:'+w/s.width*100+'%;height:'+h/H*100+'%;background:var(--line)"></div>';
            }).join('');
            return '<div class="mini-bay" style="flex:'+s.width+'">'+zones+boards+'<div class="mini-reach" style="bottom:'+Math.max(0,Math.min(100,(reach-PLINTH-PANEL)/H*100))+'%">'+(i===0?'<span>'+reach+' cm</span>':'')+'</div></div>';
        }).join('')+'</div><div class="mini-widths">'+p.sections.map(s=>'<span style="flex:'+s.width+'">'+s.width.toFixed(1)+' cm</span>').join('')+'</div>';
    }
    function proposalExplanation(p) {
        if(!p.breakdown)return '';
        const labels={accessibility:'Accessibility',clearance:'Fit and clearance',utilisation:'Use of space',grouping:'Grouping',safety:'Safety margin',buildability:'Buildability'};
        return '<details><summary>Why this plan · '+p.score.toFixed(1)+' / 100</summary><ul>'+Object.entries(p.breakdown.criteria).map(([k,v])=>'<li>'+labels[k]+': '+Math.round(v*100)+'% · weight '+Math.round(p.breakdown.weights[k]*100)+'%</li>').join('')+'</ul><ul>'+(p.placements||[]).map(q=>'<li>Section '+(q.bay+1)+' · '+esc(q.reason)+'</li>').join('')+'</ul></details>';
    }
    function tradeOffExplanation(p) {
        const c=p.comparison;
        const labels={accessibility:'Daily access fit',drawerStorage:'Foldable demand served by drawers',openStorage:'Foldable demand served by open shelves',hangingCapacity:'Hanging demand served',spareSpace:'Reserved clear space'};
        const comparison=c?'<p class="composition-proof">'+esc(labels[c.hero])+': '+Math.round(c.value*100)+'% (+'+Math.round(c.gainPoints)+' points vs Best Overall). '+esc(c.giveUp)+'</p>':'';
        const note=p.selectionNote?'<details><summary>Why fewer layouts</summary><p class="sub">'+esc(p.selectionNote)+'</p></details>':'';
        const variants=p.variations?.length?'<details><summary>'+p.variations.length+' variations in this family</summary><p class="sub">These share the same overall structure and are grouped here.</p><ul>'+p.variations.map(v=>'<li>'+esc(v.archetype)+' · '+v.score.toFixed(1)+' / 100</li>').join('')+'</ul></details>':'';
        return comparison+note+variants;
    }
    function renderIdeas() {
        const sharedNote = plannerState.ideas.flatMap(q => q.warnings || []).find(x => SHARED_NOTE.test(x));
        const growth = model.activeCabinet().state.profile.growth ?? 15;
        const allowanceNote = growth > 0 ? 'Planning targets include ' + growth + '% room to grow, rounded up from your entered quantities.' : 'Planning targets match your entered quantities.';
        $('#ideas-note').textContent = [allowanceNote, sharedNote].filter(Boolean).join(' ');
        $('#ideas-note').hidden = false;
        const cfg = geometry.plannerConfig();
        $('#wizard-size').textContent = model.activeCabinet().state.w + ' × ' + model.activeCabinet().state.h + ' × ' + model.activeCabinet().state.d + ' cm';
        $('#ideas-count').textContent = plannerState.ideas.length + (plannerState.ideas.length===1?' distinct layout':' distinct layouts');
        $('#ideas').innerHTML = plannerState.ideas.length ? plannerState.ideas.map((p, index) => {
            const m = p.metrics, issues = [...(m.errors || []), ...(p.warnings || [])].filter(x => !SHARED_NOTE.test(x));
            const fit = Math.round(m.coverage.total * 100);
            const requested = ['short', 'long', 'pants', 'folded', 'shoes', 'small'].filter(k => cfg.needs[k] > 0);
            const weakest = requested.reduce((worst, k) => !worst || m.capacities[k] / planned(k) < m.capacities[worst] / planned(worst) ? k : worst, '');
            const weakestNote = weakest && m.capacities[weakest] < planned(weakest) ? '<span class="pill warn">' + esc(PURPOSE[weakest]) + ': ' + Math.floor(m.capacities[weakest]) + ' / ' + planned(weakest) + ' fit</span>' : '';
            return '<article class="idea ' + (index === 0 ? 'best' : '') + '">' + miniPlan(p) + '<div class="idea-text"><h4><span>' + esc(p.title) + '</span>' + (index === 0 ? '<span class="pill '+(p.complete===false?'warn':'good')+'">'+(p.complete===false?'Best partial match':'Best match')+'</span>' : '') + '</h4><div class="meta"><span class="pill">' + fit + '% overall coverage</span>' + weakestNote + '<span class="pill' + (m.ergo >= .85 ? ' good' : m.ergo < .65 ? ' warn' : '') + '" title="Share of daily storage in easy-reach zones">Comfort ' + Math.round(m.ergo * 100) + '%</span><span class="pill">' + (m.seasonal.fill ? 'Seasonal storage: ' + m.seasonal.allocatedBoxes + ' boxes' : 'Seasonal ' + m.seasonal.allocatedBoxes + ' / ' + m.seasonal.targetBoxes + ' boxes') + '</span>' + '</div>' + (p.composition ? '<p class="composition-proof">'+esc(p.summary)+'</p>' : '') + tradeOffExplanation(p) + proposalExplanation(p) + '<p class="sub">Reachable capacity / planning target' + (growth > 0 ? ' (includes ' + growth + '% room to grow)' : '') + '</p><div class="capacity">' + ['short', 'long', 'pants', 'folded', 'shoes', 'small'].filter(k => cfg.needs[k] > 0).map(k => {
                const have = Math.floor(m.capacities[k]), need = planned(k), cls = have < 1 ? ' class=\"none\"' : have < need ? ' class=\"low\"' : '';
                return '<span' + cls + '>' + esc(PURPOSE[k]) + '</span><b' + cls + '>~' + have + ' / ' + need + '</b>';
            }).join('') + '</div>' + (issues.length ? '<details><summary>' + issues.length + ' trade-off' + (issues.length === 1 ? '' : 's') + ' to consider</summary><ul>' + [...new Set(issues)].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>' : m.shortfalls.length ? '' : '<div class="status">✓ Covers everything you store</div>') + '<button class="apply" data-idea="' + index + '">Use this layout</button></div></article>';
        }).join('') : '<p>'+esc(noPlanExplanation(cfg))+'</p>';
    }
    function syncPreferences() {
        const p = model.activeCabinet().state.profile;
        for (const k of Object.keys(p.needs)) {
            ( /** @type {HTMLInputElement} */($('#need-' + k))).value = p.needs[k];
        }
        $('#jackets').value = String(p.jackets ?? 0);
        $('#coats').value = String(p.coats ?? 0);
        $('#reach').value = String(p.reachStd ?? p.reach ?? 185);
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
            needs[k] = bounded('#need-' + k, 0, k === 'folded' || k === 'small' ? 200 : k === 'short' ? 150 : k === 'pants' ? 100 : 80, model.activeCabinet().state.profile.needs[k]);
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
            syncPreferences();
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
        syncPreferences();
        $('#wizard').hidden = false;
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
        $('#wizard').hidden = true;
        $('#app').inert = false;
        (plannerState.wizardTrigger || $('#launch-wizard')).focus();
    }
    function storedNow(a) {
        const rows = ['short', 'long', 'pants', 'folded', 'shoes', 'small'].map(k => [PURPOSE[k], Math.floor(a.capacities[k])]).concat([['Seasonal boxes', Math.floor(a.capacities.seasonalBoxes)]]).filter(r => r[1] > 0);
        return (rows.length ? '<div class="capacity">' + rows.map(r => '<span>' + esc(r[0]) + '</span><b>~' + r[1] + '</b>').join('') + '</div><p class="sub">What your fittings hold now, at comfortable spacing.</p>' : '<p class="sub">Nothing to store yet. Add a rail, drawer or shelf and the count appears here.</p>');
    }
    function planUI(a) {
        $('#empty-scene').hidden = geometry.stats().mods > 0 || plannerState.emptyDismissed;
        $('#plan-title').textContent = model.activeCabinet().state.proposal?.title || (geometry.stats().mods ? 'Custom wardrobe' : 'Make it yours');
        $('#plan-summary').textContent = model.activeCabinet().state.proposal?.summary || '';
        $('#plan-summary').hidden = !model.activeCabinet().state.proposal?.summary;
        $('#plan-capacity').innerHTML = !model.activeCabinet().state.profile.engaged ? storedNow(a) : '<div class="capacity">' + Object.keys(model.activeCabinet().state.profile.needs).filter(k => model.activeCabinet().state.profile.needs[k] > 0).map(k => {
            const have = Math.floor(a.capacities[k]), need = planned(k), cls = have < 1 ? ' class="none"' : have < need ? ' class="low"' : '';
            return '<span' + cls + '>' + esc(PURPOSE[k]) + '</span><b' + cls + '>~' + have + ' / ' + need + '</b><div class="bar"><i style="width:' + Math.min(100, a.coverage[k] * 100) + '%"></i></div>';
        }).join('') + '</div><p class="sub">Reachable capacity / planned quantity (incl. ' + (model.activeCabinet().state.profile.growth ?? 15) + '% room to grow)</p><div class="setting-proof">Daily access ≤ ' + a.maxDailyAccess + ' cm / ' + model.activeCabinet().state.profile.reach + ' cm<br>Daily comfort ' + Math.round(a.ergo * 100) + '%<br>' + (a.seasonal.fill ? 'Spare-space boxes ' + a.seasonal.allocatedBoxes : 'Seasonal boxes ' + a.seasonal.allocatedBoxes + ' / ' + a.seasonal.targetBoxes) + '</div>';
        const eng = model.activeCabinet().state.profile.engaged, issues = [...a.errors, ...a.warnings.filter(x => eng || !x.startsWith('Seasonal storage:'))];
        {
            const nIssues = new Set(issues).size, fw = $('#fit-warn');
            fw.hidden = !nIssues;
            fw.textContent = String(nIssues);
            fw.title = nIssues + (nIssues === 1 ? ' note' : ' notes');
        }
        $('#plan-warnings').innerHTML = [...new Set(issues)].map(x => '<div class="issue">' + esc(x) + '</div>').join('');
    }
    function markIdeasDirty() {
        if ($('#wizard').hidden) {
            return;
        }
        lifetime.cancelTimeout(plannerState.ideasTimer);
        const p = model.activeCabinet().state.profile;
        const reach = readPreferences().reach;
        $('#reach-value').textContent = reach + ' cm' + (p.accessible ? ' · seated' : '');
        $('#ideas-count').textContent = 'Settings changed · updating';
        $('#ideas').setAttribute('aria-busy', 'true');
        $('#ideas').querySelectorAll('[data-idea]').forEach(b => ( /** @type {HTMLInputElement} */(b)).disabled = true);
        plannerState.ideasTimer = lifetime.timeout(() => refreshIdeas(true), 350);
    }
    return { miniPlan, renderIdeas, syncPreferences, readPreferences, refreshIdeas, openWizard, closeWizard, storedNow, planUI, markIdeasDirty, planned };
}
