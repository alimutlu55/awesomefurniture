import type { AnalyticsProperties, AssemblyEntry, AssemblyExit, AssemblyVisitSummary, MakeExit, MakeVisitSummary } from '../../domain/analytics/analytics-events';
import type { TrackEvent } from './analytics-port';

type Product = AnalyticsProperties<'make_opened'>['product'];
type Wanted = 'assembly' | 'drawings';
export type MakeExportKind = 'pdf' | 'csv' | 'parts';

/** Where the film stood when Assembly Studio closed (read from the player by the view). */
export interface FilmFacts {
  readonly steps: number;
  /** The step showing, and the furthest step played to, both counted from 0. */
  readonly atStep: number;
  readonly furthestStep: number;
  readonly finished: boolean;
  /** Seconds of film played (either way), and the film's length in seconds. */
  readonly watched: number;
  readonly duration: number;
}

/**
 * What happens in Make, as the view reports it: one note per thing the person does. The notes are summed up into one
 * event when Make closes (make_closed) and one when Assembly Studio closes (assembly_studio_closed); the steps that
 * matter on their own (a tab, the gate closing, a save and what stopped it) are events of their own as well.
 */
export type MakeNote =
  | { kind: 'opened'; parts: number; findings: number }
  | { kind: 'closed'; exit: MakeExit }
  /** The page was hidden (another tab, the phone locked, the page closing) or shown again while Make was open. */
  | { kind: 'hidden'; film: FilmFacts | null }
  | { kind: 'shown'; studio: boolean }
  /** A toolbar or View menu tool, by its action key ('make-apart', 'look-xray', 'view-front' ...). */
  | { kind: 'tool'; key: string }
  | { kind: 'panel'; mode: 'list' | 'part'; tab: 'parts' | 'hardware' | 'cutting' }
  | { kind: 'tab'; tab: 'parts' | 'hardware' | 'cutting' }
  | { kind: 'pick'; part: number; via: 'canvas' | 'list' | 'step' | 'finding' }
  | { kind: 'touch'; zoom: boolean }
  | { kind: 'finding' } | { kind: 'hardware' } | { kind: 'price' } | { kind: 'drawings' }
  | { kind: 'construction'; setting: 'joints' | 'back' | 'edge_band_mm'; value: string }
  | { kind: 'gate'; wanted: Wanted; blockers: number; notes: number; packs: readonly string[]; rules: readonly string[] }
  | { kind: 'gate_action'; action: 'retry' | 'open_check'; wanted: Wanted; open: boolean }
  | { kind: 'export'; format: MakeExportKind; parts: number; outcome: 'requested' | 'saved' | 'gate_blocked' | 'not_paid' | 'piece_changed' | 'failed' }
  | { kind: 'studio_opened'; parts: number; entry: AssemblyEntry; direct: boolean; step: number }
  /** A control in Assembly Studio, by its action ('play', 'chapter', 'mode', 'part', 'seek', 'speed' ...). */
  | { kind: 'studio'; action: string; value?: number }
  | { kind: 'studio_closed'; exit: AssemblyExit; film: FilmFacts };

function visitOf(at: number, parts: number, resumed: boolean) {
  return { at, parts, resumed, tools: new Set<string>(), toolUses: 0, panel: false, tabs: new Set<string>(), picked: new Set<number>(), picks: 0,
    via: { canvas: 0, list: 0, step: 0, finding: 0 }, findings: 0, hardware: 0, band: false, construction: 0, touches: 0, zoomed: false,
    studioOpens: 0, studioMs: 0, gateBlocks: 0, price: false, drawings: false, check: false, requested: 0, saved: 0, last: resumed ? 'resumed' : 'open' };
}
function studioOf(at: number, parts: number, entry: AssemblyEntry | 'resumed') {
  return { at, parts, entry, plays: 0, pauses: 0, reversed: false, steps: 0, chapters: 0, scrubbed: false, speed: false, explore: false,
    inspected: new Set<number>(), connections: 0, chapterList: false, guide: false };
}

export function createMakeUsage(deps: { readonly track: TrackEvent; product(): Product; now?: () => number }) {
  const now = deps.now ?? Date.now, track = deps.track;
  let visit: ReturnType<typeof visitOf> | null = null, studio: ReturnType<typeof studioOf> | null = null;
  // Set when the person leaves Make for something it opened (the price, Design check): the Done that follows says so.
  let leavingFor: MakeExit | null = null, suspended: { parts: number; studio: AssemblyEntry | 'resumed' | null } | null = null;

  function closeVisit(exit: MakeExit) {
    if (!visit) return;
    const v = visit; visit = null;
    const summary: MakeVisitSummary = {
      duration_ms: Math.max(0, now() - v.at), exit: exit === 'done' && leavingFor ? leavingFor : exit, resumed: v.resumed, part_count: v.parts,
      tools_used: [...v.tools], tool_uses: v.toolUses, panel_opened: v.panel, tabs_viewed: [...v.tabs],
      parts_picked: v.picked.size, part_picks: v.picks, picks_canvas: v.via.canvas, picks_list: v.via.list, picks_step: v.via.step,
      findings_opened: v.findings, hardware_rows_opened: v.hardware, edge_band_changed: v.band, construction_changes: v.construction,
      canvas_touches: v.touches, zoomed: v.zoomed, assembly_opens: v.studioOpens, assembly_ms: v.studioMs, gate_blocks: v.gateBlocks,
      price_opened: v.price, drawings_opened: v.drawings, design_check_opened: v.check, exports_requested: v.requested, exports_saved: v.saved,
      last_action: v.last,
    };
    leavingFor = null;
    track('make_closed', summary);
  }
  function closeStudio(exit: AssemblyExit, film: FilmFacts) {
    if (!studio) return;
    const s = studio; studio = null;
    const ms = Math.max(0, now() - s.at);
    if (visit) visit.studioMs += ms;
    const summary: AssemblyVisitSummary = {
      duration_ms: ms, exit, entry: s.entry, part_count: s.parts, steps_total: film.steps, furthest_step: film.steps ? film.furthestStep + 1 : 0,
      at_step: film.steps ? film.atStep + 1 : 0, finished: film.finished, watched_ratio: film.duration > 0 ? film.watched / film.duration : 0,
      play_presses: s.plays, pauses: s.pauses, reversed: s.reversed, steps_stepped: s.steps, chapters_jumped: s.chapters, scrubbed: s.scrubbed,
      speed_changed: s.speed, explore_used: s.explore, parts_inspected: s.inspected.size, connections_shown: s.connections,
      chapter_list_opened: s.chapterList, guide_opened: s.guide,
    };
    track('assembly_studio_closed', summary);
  }
  function studioAction(action: string, value?: number) {
    const s = studio;
    if (!s) return;
    if (action === 'part' && value !== undefined && value > 0) s.inspected.add(value);
    if (action === 'play' || action === 'reverse') { s.plays++; if (action === 'reverse') s.reversed = true; }
    else if (action === 'pause') s.pauses++;
    else if (action === 'previous' || action === 'next') s.steps++;
    else if (action === 'chapter' || action === 'part-stage') s.chapters++;
    else if (action === 'seek') s.scrubbed = true;
    else if (action === 'speed') s.speed = true;
    else if (action === 'mode' || action === 'part' || action === 'fit') s.explore = true;
    else if (action === 'connection') s.connections++;
    else if (action === 'chapters') s.chapterList = true;
    else if (action === 'guide') s.guide = true;
  }

  function handle(n: MakeNote) {
    if (n.kind === 'opened') {
      if (visit) closeVisit('editor_closed');
      visit = visitOf(now(), n.parts, false); leavingFor = null; suspended = null;
      track('make_opened', { product: deps.product(), part_count: n.parts, finding_count: n.findings });
      return;
    }
    if (n.kind === 'shown') {
      if (!suspended || visit) return;
      visit = visitOf(now(), suspended.parts, true);
      if (n.studio && suspended.studio) studio = studioOf(now(), suspended.parts, 'resumed');
      suspended = null;
      return;
    }
    if (n.kind === 'studio_closed') { closeStudio(n.exit, n.film); if (visit) visit.last = 'assembly_closed'; return; }
    const v = visit;
    if (!v) return;
    if (n.kind === 'hidden') {
      const entry = studio ? studio.entry : null;
      if (n.film) closeStudio('page_hidden', n.film);
      suspended = { parts: v.parts, studio: entry };
      closeVisit('page_hidden');
    }
    else if (n.kind === 'closed') closeVisit(n.exit);
    else if (n.kind === 'tool') {
      const tool = n.key.replace(/^make-/, '');
      v.tools.add(tool); v.toolUses++; v.last = 'tool:' + tool;
    }
    else if (n.kind === 'panel') { v.panel = true; if (n.mode === 'list') v.tabs.add(n.tab); }
    else if (n.kind === 'tab') { v.tabs.add(n.tab); v.last = 'tab:' + n.tab; track('make_tab_viewed', { tab: n.tab }); }
    else if (n.kind === 'pick') { v.picked.add(n.part); v.picks++; v.via[n.via]++; v.last = 'pick'; }
    else if (n.kind === 'touch') { if (n.zoom) v.zoomed = true; else v.touches++; }
    else if (n.kind === 'finding') { v.findings++; v.last = 'finding'; }
    else if (n.kind === 'hardware') { v.hardware++; v.last = 'hardware'; }
    else if (n.kind === 'price') { v.price = true; v.last = 'price'; leavingFor = 'price'; track('make_price_opened', { product: deps.product() }); }
    else if (n.kind === 'drawings') { v.drawings = true; v.last = 'drawings'; }
    else if (n.kind === 'construction') {
      if (n.setting === 'edge_band_mm') v.band = true; else v.construction++;
      v.last = 'construction:' + n.setting;
      track('make_construction_changed', { setting: n.setting, value: n.value });
    }
    else if (n.kind === 'gate') {
      v.gateBlocks++; v.last = 'gate:' + n.wanted;
      track('make_gate_blocked', { wanted: n.wanted, blocker_count: n.blockers, note_count: n.notes, blocking_packs: n.packs, blocking_rules: n.rules });
    }
    else if (n.kind === 'gate_action') {
      if (n.action === 'open_check') { v.check = true; leavingFor = 'design_check'; }
      v.last = 'gate:' + n.action;
      track('make_gate_action', { action: n.action, wanted: n.wanted, now_open: n.open });
    }
    else if (n.kind === 'export') {
      const format = n.format === 'parts' ? 'parts_csv' : n.format;
      if (n.outcome === 'requested') { v.requested++; v.last = 'export:' + format; return; }
      v.last = 'export:' + format + ':' + n.outcome;
      if (n.outcome === 'saved') { v.saved++; track('make_export_saved', { format, part_count: n.parts }); }
      else track('make_export_stopped', { format, reason: n.outcome });
    }
    else if (n.kind === 'studio_opened') {
      if (studio) return;
      studio = studioOf(now(), n.parts, n.entry); v.studioOpens++; v.last = 'assembly';
      track('assembly_studio_opened', { part_count: n.parts, direct: n.direct, entry: n.entry, start_step: n.step + 1 });
    }
    else if (n.kind === 'studio') studioAction(n.action, n.value);
  }
  return {
    /** Never throws: analytics must not break Make. */
    note(n: MakeNote) { try { handle(n); } catch { /* analytics only */ } },
  };
}
export type MakeUsage = ReturnType<typeof createMakeUsage>;
