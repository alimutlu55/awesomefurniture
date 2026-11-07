import type { CreditCurrency } from '../credits/credit-catalog';

/**
 * Product analytics: what is measured, and nothing that identifies a person or reveals a design. Each event is one
 * entry in ANALYTICS_EVENTS; its properties are typed in AnalyticsEventMap. Properties are summary values only: counts,
 * sizes, registry keys, outcomes. Never an email, a name, a prompt, a token or the design itself (docs/analytics.md).
 */
type Product = 'wardrobe' | 'kitchen';
type Style = 'realistic' | 'studio' | 'concept';

export interface AnalyticsEventMap {
  // Acquisition and start-up
  editor_session_started: { entry_type: 'new' | 'restored_draft' | 'restored_cloud' | 'shared_session' | 'design_hash' | 'spec_hash' | 'library';
    utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; cloud_available: boolean };
  editor_startup_failed: { reason: 'webgl_unavailable' | 'storage_error' | 'unknown' };
  shared_link_opened: { link_kind: 'session' | 'design_hash' | 'spec_hash'; status: 'opened' | 'invalid' };
  agent_api_invoked: { method: 'help' | 'check' | 'build' | 'link' | 'describe'; ok: boolean };
  // Welcome and experience
  welcome_opened: { trigger: 'initial_empty_design' | 'menu_plan_from_owned' };
  welcome_space_selected: { space_id: string; previewed_spaces_count: number };
  welcome_built: { space_id: string; persona_id: string; total_belongings: number; build_ok: boolean; duration_ms: number };
  welcome_skipped: { abandoned_at_step: 'space' | 'things'; space_id: string; time_spent_ms: number };
  fit_reveal_shown: { everything_fits: boolean; placed_count: number; missing_count: number };
  fit_reveal_action_clicked: { action: string };
  scene_mood_changed: { setting: 'look' | 'time' | 'lens' | 'sound'; value: string };
  // Designing
  design_first_work_committed: { time_to_first_work_ms: number; piece_count: number };
  furniture_piece_added: { product: Product; preset_id: string | null; placement: 'wall' | 'beside' | 'duplicate'; total_pieces_in_scene: number };
  kitchen_array_committed: { copies_added: number };
  wardrobe_shape_changed: { shape_kind: string; method: 'preset' | 'handle_drag' | 'numeric_input' };
  studio_room_edited: { action: string; detail_kind: string };
  // Auto design
  auto_design_opened: { wardrobe_w_cm: number; wardrobe_h_cm: number; wardrobe_d_cm: number };
  auto_design_proposals_generated: { proposal_count: number; complete_fit: boolean; compute_ms: number };
  auto_design_proposal_applied: { chosen_rank: number; chosen_archetype: string | null };
  // Make
  make_opened: { product: Product; part_count: number };
  make_construction_changed: { setting: 'joints' | 'back' | 'edge_band_mm'; value: string };
  make_export_saved: { format: 'pdf' | 'csv'; part_count: number };
  // Technical drawings
  drawings_opened: { sheet_count: number; ready_for_manufacture: boolean; blocking_findings_count: number; blocking_rule_ids: readonly string[];
    review_issues_count: number; wardrobe_count: number; kitchen_unit_count: number };
  drawings_pdf_exported: { sheet_count: number; ready_for_manufacture: boolean; blocking_findings_count: number };
  // AI design images
  ai_image_dialog_opened: { category: Product; piece_count: number; has_previous_result: boolean };
  ai_image_generation_started: { style: Style; category: Product; is_retry: boolean };
  ai_image_generation_completed: { style: Style; category: Product; latency_ms: number };
  ai_image_generation_failed: { style: Style; outcome: string; elapsed_ms: number };
  ai_image_downloaded: { style: Style; category: Product };
  // Accounts and credits
  credit_gate_triggered: { feature: string; gate_outcome: 'free_or_pass' | 'paid_confirm_prompt' | 'insufficient_credits' | 'account_required';
    balance: number; cost: number };
  account_sheet_opened: { trigger: 'menu' | 'credits'; initial_view: string };
  account_auth_submitted: { method: string; outcome: 'success' | 'otp_sent' | 'error'; error_code: string | null };
  guest_work_handover_decided: { decision: 'adopted' | 'declined'; outcome: 'success' | 'failed' };
  wallet_opened: { trigger: 'menu' | 'insufficient_credits' | 'checkout_return'; needed_feature: string | null; balance: number };
  wallet_pack_selected: { pack_id: string };
  checkout_started: { pack_id: string; credits: number; amount_minor: number; currency: string; provider: string };
  payment_settled: { pack_id: string; credits: number; amount_minor: number; currency: string; settled_via: 'webhook' | 'return_poll' | 'cron_reconcile' };
  // Your designs and sharing
  design_library_action: { action: 'opened_library' | 'created_design' | 'switched_design' | 'renamed' | 'duplicated' | 'deleted'; local_only: boolean };
  design_shared: { product_mix: 'wardrobe' | 'kitchen' | 'both' | 'empty'; piece_count: number };
}
export type AnalyticsEventName = keyof AnalyticsEventMap;
export type AnalyticsProperties<K extends AnalyticsEventName = AnalyticsEventName> = AnalyticsEventMap[K];

export type AnalyticsPillar = 'acquisition' | 'activation' | 'engagement' | 'realization' | 'monetization' | 'retention';
interface EventDefinition {
  readonly pillar: AnalyticsPillar;
  /** Counts towards the North Star: a design that reached something a person can make, show or share (drawings only
   * when they pass the manufacturing check). `analytics.weekly_realized_designs` lists the same events. */
  readonly realizes?: true;
  /** Sent by the Worker, never accepted from a browser. */
  readonly server?: true;
}

/** Every event, once. The Worker accepts only these names (and none marked `server` from a browser). */
export const ANALYTICS_EVENTS = {
  editor_session_started: { pillar: 'acquisition' }, editor_startup_failed: { pillar: 'acquisition' },
  shared_link_opened: { pillar: 'acquisition' }, agent_api_invoked: { pillar: 'acquisition' },
  welcome_opened: { pillar: 'activation' }, welcome_space_selected: { pillar: 'activation' }, welcome_built: { pillar: 'activation' },
  welcome_skipped: { pillar: 'activation' }, fit_reveal_shown: { pillar: 'activation' }, fit_reveal_action_clicked: { pillar: 'activation' },
  scene_mood_changed: { pillar: 'engagement' }, design_first_work_committed: { pillar: 'activation' },
  furniture_piece_added: { pillar: 'engagement' }, kitchen_array_committed: { pillar: 'engagement' },
  wardrobe_shape_changed: { pillar: 'engagement' }, studio_room_edited: { pillar: 'engagement' },
  auto_design_opened: { pillar: 'engagement' }, auto_design_proposals_generated: { pillar: 'engagement' },
  auto_design_proposal_applied: { pillar: 'engagement' },
  make_opened: { pillar: 'engagement' }, make_construction_changed: { pillar: 'engagement' },
  make_export_saved: { pillar: 'realization', realizes: true },
  drawings_opened: { pillar: 'realization', realizes: true }, drawings_pdf_exported: { pillar: 'realization', realizes: true },
  ai_image_dialog_opened: { pillar: 'realization' }, ai_image_generation_started: { pillar: 'realization' },
  ai_image_generation_completed: { pillar: 'realization', realizes: true },
  ai_image_generation_failed: { pillar: 'realization' }, ai_image_downloaded: { pillar: 'realization' },
  credit_gate_triggered: { pillar: 'monetization' }, account_sheet_opened: { pillar: 'monetization' },
  account_auth_submitted: { pillar: 'monetization' }, guest_work_handover_decided: { pillar: 'monetization' },
  wallet_opened: { pillar: 'monetization' }, wallet_pack_selected: { pillar: 'monetization' },
  checkout_started: { pillar: 'monetization', server: true }, payment_settled: { pillar: 'monetization', server: true },
  design_library_action: { pillar: 'retention' }, design_shared: { pillar: 'realization', realizes: true },
} as const satisfies Record<AnalyticsEventName, EventDefinition>;

export const isAnalyticsEvent = (name: unknown): name is AnalyticsEventName =>
  typeof name === 'string' && Object.hasOwn(ANALYTICS_EVENTS, name);
export const isServerEvent = (name: AnalyticsEventName): boolean => 'server' in ANALYTICS_EVENTS[name];
export const realizingEvents = (): AnalyticsEventName[] =>
  (Object.keys(ANALYTICS_EVENTS) as AnalyticsEventName[]).filter(name => 'realizes' in ANALYTICS_EVENTS[name]);

export type AnalyticsViewport = 'phone' | 'tablet' | 'desktop';
export type AnalyticsEntrySource = 'direct' | 'marketing_page' | 'shared_session' | 'design_link' | 'spec_link' | 'external';

/** What a browser sends. Who the person is (account, guest) and where they are come from the Worker, never from here. */
export interface AnalyticsEnvelope<K extends AnalyticsEventName = AnalyticsEventName> {
  readonly eventId: string;
  readonly event: K;
  readonly occurredAt: string;
  /** A random id kept in this browser; not tied to the account. */
  readonly anonymousId: string;
  /** A random id per tab. */
  readonly clientSessionId: string;
  readonly designId: string | null;
  readonly context: { readonly locale: string; readonly viewport: AnalyticsViewport; readonly entrySource: AnalyticsEntrySource;
    readonly referrerPath: string | null };
  readonly properties: AnalyticsProperties<K>;
}

/** The envelope as stored: with the verified person and the country the Worker saw. */
export interface StoredAnalyticsEvent extends Omit<AnalyticsEnvelope, 'clientSessionId'> {
  readonly clientSessionId: string | null;
  readonly userId: string | null;
  readonly isAnonymous: boolean;
  readonly country: string | null;
  readonly currency: CreditCurrency | null;
  readonly source: 'browser' | 'server';
}

/** The viewport class the editor's own layout uses: phone below 600 px, tablet to 900 px. */
export function viewportClass(width: number): AnalyticsViewport {
  return width < 600 ? 'phone' : width < 901 ? 'tablet' : 'desktop';
}
