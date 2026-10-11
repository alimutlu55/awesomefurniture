import { planSectionChange,redesignSectionChange,sectionChangeKey } from './section-change-plan';
import type { SectionChangePlan } from './section-change-plan';
import type { PlannerProposal } from '../../domain/planner/wardrobe-planner';
import { selectStorageLayouts,scoreLayout } from '../../domain/planner/selection-planner';
import { buildDemand } from '../../domain/planner/selection-config';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'report' | 'checkpoint' | 'closeInspector' | 'changed' | 'requestUndo'>;
    rules: Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'plannerConfig' | 'currentLayout' | 'widths' | 'maxN'>;
};
export function createLayoutCommands({ getDesign, effects, rules }: Ports) {
    /** Plan one bay. `height` overrides the outer height for bays under a lower top. */
    function autofill(i: number, height?: number) {
        const config = { ...rules.plannerConfig(), ...(height === undefined ? {} : { h: height }) }, other = rules.currentLayout();
        other.sections = other.sections.filter((_, j) => j !== i);
        const existing = WardrobePlanner.analyze(other, config), demand = buildDemand(config);
        const pinned = getDesign().proposal === null ? getDesign().secs[i]!.filter(it => it.x !== undefined || it.y !== undefined) : [];
        const boards = getDesign().dividers.filter(d => d.i === i).map(d => ({ ...d, i: 0 }));
        const scoped = { ...config, w: rules.widths()[i]! + 3.6, growth: 0,
            needs: Object.fromEntries(Object.entries(demand).map(([k, n]) => [k, Math.max(0, n - existing.capacities[k]!)])),
            fixedSections: [{ width: rules.widths()[i]!, items: pinned }], fixedDividers: boards };
        const proposal = selectStorageLayouts(scoped)[0];
        if (!proposal) { effects.report('This bay cannot fit the current storage requirements'); return; }
        getDesign().secs[i] = structuredClone(proposal.sections[0]!.items);
        getDesign().dividers = getDesign().dividers.filter(d => d.i !== i).concat(proposal.dividers.map(d => ({ ...d, i })));
        getDesign().space = null;
        getDesign().proposal = null;
        getDesign().profile.engaged = true;
    }
    function applyProposal(p: PlannerProposal,selected=0) {
        effects.checkpoint();
        // An idea planned for the wardrobe's own bays keeps their exact weights, so steps anchored to
        // bay boundaries do not shift by floating-point noise.
        const current = rules.widths(), sameBays = p.sections.length === getDesign().n && p.sections.every((s, i) => Math.abs(s.width - current[i]!) < .01);
        getDesign().n = p.sections.length;
        if (!sameBays) getDesign().wt = p.sections.map(s => s.width).concat([100, 100, 100, 100, 100, 100]).slice(0, 6);
        getDesign().secs = p.sections.map(s => structuredClone(s.items)).concat([[], [], [], [], [], []]).slice(0, 6);
        getDesign().sel = selected;
        getDesign().item = -1;
        getDesign().divider = -1;
        getDesign().dividers = structuredClone(p.dividers ?? []);
        getDesign().space = null;
        getDesign().proposal = { title: p.title, summary: p.summary };
        getDesign().profile.engaged = true;
        effects.closeInspector();
        effects.changed();
        effects.report('Applied: ' + p.title);
    }
    function prepareSectionChange(delta:number) {
        return planSectionChange(getDesign(),delta,rules.plannerConfig());
    }
    function redesignSections(plan:SectionChangePlan) {
        if(plan.sourceKey!==sectionChangeKey(getDesign()))return null;
        return redesignSectionChange(plan,rules.plannerConfig());
    }
    function applySectionChange(plan:SectionChangePlan) {
        if(plan.sourceKey!==sectionChangeKey(getDesign())||!plan.proposal){effects.report('Layout changed. Try the section change again.');return false;}
        const checked=planSectionChange(getDesign(),plan.count-getDesign().n,rules.plannerConfig());
        if(!checked)return false;
        // Revalidate detached geometry before committing a single history entry.
        const p=plan.proposal;
        const width=p.sections.reduce((n,s)=>n+s.width,0)+(p.sections.length+1)*PANEL;
        const valid=scoreLayout(p.sections,rules.plannerConfig(),p.dividers??[]).metrics.valid;
        if(!valid||p.sections.length!==plan.count||Math.abs(width-getDesign().w)>.03)return false;
        applyProposal(p,plan.selected);
        return true;
    }
    function changeSections(delta:number) {
        if(delta!==1&&delta!==-1)return;
        if(getDesign().secs.some(items=>items.length)||getDesign().dividers.length){
            let plan=prepareSectionChange(delta);
            if(!plan){effects.report('No room for this section count');return;}
            if(!plan.proposal)plan=redesignSections(plan);
            if(!plan?.proposal){effects.report('No fitting layout found for this section count');return;}
            if(applySectionChange(plan)){
                const fit=Math.floor((plan.proposal.inventory?.coverage??plan.proposal.metrics.coverage.total??0)*100);
                effects.report(`${plan.count} sections · ${plan.redesigned?'Redesigned':'Fittings preserved'} · ${fit}% fit`,{label:'Undo',fn:effects.requestUndo});
            }
            return;
        }
        const n=getDesign().n+delta;
        if(n<1||n>rules.maxN()){effects.report('Not enough room for this section count');return;}
        effects.checkpoint();
        getDesign().n=n;
        getDesign().wt=Array(6).fill(100);
        getDesign().sel=Math.min(getDesign().sel,n-1);
        getDesign().item=-1;getDesign().divider=-1;getDesign().space=null;getDesign().proposal=null;
        effects.changed();
    }
    return { autofill, applyProposal, changeSections };
}
