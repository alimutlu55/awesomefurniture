import * as THREE from 'three';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { ProjectDocument } from '../../domain/project/project';
import { buildFromSpec } from '../../application/spec/build-from-spec';
import { describeScene } from '../../application/spec/describe-scene';
import { singleWallStudio } from '../../domain/studio/studio-edit';
import type { CameraPose, CameraState } from '../viewport/camera-types';
import type { LightSetting } from '../viewport/scene-lighting';
import { createSceneLooks, type SceneLook } from '../viewport/scene-looks';
import { createWardrobeLamps, timeOfDay } from '../viewport/daylight';
import { createAssemblyMotion, type AssemblyPhase } from '../viewport/assembly-motion';
import { createWorkshopLens } from '../viewport/workshop-lens';
import { createWelcome } from './welcome';
import { createReveal, fitSummary } from './reveal';
import { createMoodControl, type Mood } from './mood-control';
import { createWoodSounds } from './wood-sounds';
import { readPreferences, writePreferences } from './preferences';
import { buildInBackground } from './spec-worker-client';
import { countBelongings, spaceSpec, type Belongings, type Space } from './spaces';
import { createStageFraming } from './stage-framing';
import type { ExperienceDocument, ExperienceLifetime } from './lifetime.ports';

export interface ExperiencePorts {
  readonly dom: {
    $(selector: string): HTMLElement; readonly document: ExperienceDocument; readonly host: HTMLElement;
    matchMedia(query: string): { readonly matches: boolean };
  };
  readonly lifetime: ExperienceLifetime;
  readonly resources: {
    readonly scene: THREE.Scene; readonly cam: THREE.PerspectiveCamera; readonly R: THREE.WebGLRenderer; readonly cv: HTMLCanvasElement;
    readonly lighting: { set(setting: LightSetting): void }; readonly frameHooks: Set<(camera: THREE.PerspectiveCamera, dt: number) => void>;
    readonly ground?: THREE.Object3D | undefined; readonly aoTexture?: THREE.Texture | undefined;
  };
  readonly renderState: { readonly wardrobeGroups: THREE.Object3D[]; readonly pivots: THREE.Object3D[]; readonly buildStamp: number };
  readonly cameraState: CameraState;
  readonly camera: {
    applyView(): void; cameraTransition(goal: CameraPose, duration: number): void; frameScene(): void;
    sceneBox(): { x: number; z: number; w: number; d: number; h: number };
    fittedCamera(az: number, el: number, padding: number, bounds: { x: number; z: number; w: number; d: number; h: number; y?: number }): CameraPose;
  };
  scene(): EditorScene;
  /** Shows a design without an undo step (a preview), or puts one in as one undo step, framed whole. */
  readonly design: { preview(project: ProjectDocument): void; replace(project: ProjectDocument): void; snapshot(): string; restore(snapshot: string): void };
  drawings(): void;
  autoDesign(): void;
  closeMenu(): void;
}

const KNOCKS: Record<AssemblyPhase, 'board' | 'fitting' | 'door'> = { base: 'board', side: 'board', back: 'board', top: 'board', fitting: 'fitting', door: 'door' };

/**
 * The editor's experience layer: the welcome that builds a wardrobe from what someone owns, the wardrobe
 * assembling itself, the moods of the scene (living, maquette, workshop; morning to night) and the fit reveal.
 * Everything here draws over the editor and changes how the scene looks, never the design itself, except when
 * the person builds a design, which is one undo step.
 */
export function mountExperience(ports: ExperiencePorts) {
  const { dom, lifetime, resources, renderState, cameraState } = ports, doc = dom.document, page = dom.host.ownerDocument, view = page.defaultView;
  const storage = () => { try { return view?.localStorage ?? null; } catch { return null; } };
  const saved = readPreferences(storage);
  const mood: Mood = { look: (['living', 'maquette', 'workshop'].includes(saved.look) ? saved.look : 'living') as SceneLook, time: timeOfDay(saved.time).id, sounds: saved.sounds, apart: 0, flat: false };
  const reduced = () => !!view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const looks = createSceneLooks({ scene: resources.scene, skip: o => o === resources.ground,
    shading: m => !!resources.aoTexture && (m as THREE.MeshBasicMaterial).map === resources.aoTexture,
    version: () => renderState.buildStamp * 1e6 + resources.R.info.memory.geometries });
  const lamps = createWardrobeLamps(resources.scene);
  const lens = createWorkshopLens(resources.scene);
  const sounds = createWoodSounds(view as unknown as { AudioContext?: typeof AudioContext });
  const isDoor = (o: THREE.Object3D) => renderState.pivots.includes(o);
  const assembly = createAssemblyMotion({ isDoor });
  // Panels are docked beside the view from this width, as every editor panel is.
  const docked = dom.matchMedia('(min-width:901px)');
  const framing = createStageFraming({ resources, cameraState, applyView: () => ports.camera.applyView() });
  lifetime.cleanup(() => { looks.dispose(); lamps.dispose(); lens.dispose(); sounds.dispose(); });
  sounds.setEnabled(mood.sounds);

  /** Applies the mood to the scene: the look, the light of the time of day, the workshop's board and lens. */
  function applyMood(save = true) {
    const time = timeOfDay(mood.time), workshop = mood.look === 'workshop';
    resources.lighting.set(time.light);
    looks.set({ look: mood.look, env: workshop ? 1 : time.env, emissive: workshop ? 1 : time.emissive });
    lens.set({ board: workshop ? 1 : 0, flatten: workshop && mood.flat ? 1 : 0 });
    if (!workshop && mood.apart) { mood.apart = 0; assembly.explode(renderState.wardrobeGroups, 0); }
    dom.host.dataset.look = mood.look;
    dom.host.dataset.time = workshop ? 'midday' : time.id;
    if (save) writePreferences(storage, { ...readPreferences(storage), look: mood.look, time: mood.time, sounds: mood.sounds });
    control.render();
  }
  function change(next: Partial<Mood>) {
    Object.assign(mood, next);
    if (next.sounds !== undefined) sounds.setEnabled(next.sounds);
    if (next.apart !== undefined) { assembly.explode(renderState.wardrobeGroups, next.apart); resources.R.shadowMap.needsUpdate = true; }
    if (next.flat !== undefined || (next.look !== undefined && next.look !== 'workshop' && mood.flat)) elevation(mood.look === 'workshop' && mood.flat);
    if (next.look !== undefined || next.time !== undefined || next.flat !== undefined) applyMood();
    else if (next.sounds !== undefined) writePreferences(storage, { ...readPreferences(storage), sounds: mood.sounds });
  }
  const control = createMoodControl({ bar: dom.$('#topright'), container: dom.$('#app'), document: doc, lifetime, docked, mood: () => mood, change, drawings: () => ports.drawings() });
  lifetime.cleanup(() => control.dispose());
  const reveal = createReveal({ container: dom.$('#app'), document: doc, lifetime, docked,
    night: () => change({ time: 'night', look: mood.look === 'workshop' ? 'living' : mood.look }), workshop: () => change({ look: 'workshop' }), autoDesign: () => ports.autoDesign() });
  lifetime.cleanup(() => reveal.dispose());

  // The welcome: the room previews behind it; Build plans in the background, then the wardrobe assembles.
  let before: string | null = null, shown: EditorScene | null = null, building = false;
  const projectOf = (spec: ReturnType<typeof spaceSpec>) => { const built = buildFromSpec(spec, 'preview'); return built.ok ? built.project : null; };
  const welcome = createWelcome({
    container: dom.$('#app'), document: doc, lifetime, view: view as (Window & typeof globalThis) | null, docked,
    preview(space: Space) {
      before ??= ports.design.snapshot();
      const project = projectOf(spaceSpec(space));
      if (!project) return;
      ports.design.preview(project);
      shown = ports.scene();
    },
    prepare: (space: Space, belongings: Belongings) => { if (countBelongings(belongings)) void buildInBackground(spaceSpec(space, belongings)); },
    async build(space: Space, belongings: Belongings) {
      building = true;
      try {
        const built = await buildInBackground(spaceSpec(space, belongings));
        if (!built) return { ok: false as const, message: 'The design could not be built here. Try again, or start empty.' };
        if (!built.ok) return { ok: false as const, message: friendly(built.problems.map(p => p.message)) };
        if (before !== null) ports.design.restore(before);
        before = shown = null;
        ports.design.replace(built.project);
        void play().then(() => {
          const focused = doc.activeElement as HTMLElement | null, report = describeScene(ports.scene());
          reveal.show(report);
          // The welcome closed under the keyboard focus: it moves to the reveal.
          if (!focused || focused.closest('.xp-welcome') || focused === dom.host) reveal.focus();
          if (fitSummary(report).all) sounds.fits();
        });
        return { ok: true as const };
      } finally { building = false; }
    },
    skip() {
      if (before !== null) ports.design.restore(before);
      before = shown = null;
    },
    layout: rect => framing.around(rect),
  });
  lifetime.cleanup(() => welcome.dispose());
  const friendly = (messages: string[]) => messages.some(m => /no layout|ask for less/i.test(m))
    ? 'That is more than this space can hold. Count a little less, or choose a bigger space.'
    : messages[0] ?? 'The design could not be built.';

  /** Squares the camera to the front of the active wardrobe for an elevation, or goes back to the whole room. */
  function elevation(on: boolean) {
    if (!on) { mood.flat = false; ports.camera.frameScene(); return; }
    const scene = ports.scene(), w = scene.wardrobes.find(c => c.id === scene.activeWardrobe) ?? scene.wardrobes[0];
    if (!w) return;
    const bounds = { x: w.x, z: w.z, w: w.state.w, d: w.state.d, h: w.state.h, y: (w.y ?? 0) + w.state.h / 2 };
    ports.camera.cameraTransition(ports.camera.fittedCamera(w.angle * Math.PI / 180, .02, 1.25, bounds), 900);
  }
  /** Builds the scene's wardrobes in, with a knock for each part landing. */
  function play() {
    if (reduced()) return Promise.resolve();
    dom.host.classList.add('xp-assembling');
    return assembly.play(renderState.wardrobeGroups, { onLand: phase => sounds.knock(KNOCKS[phase]) })
      .finally(() => dom.host.classList.remove('xp-assembling'));
  }
  /** Auto design applied to a wardrobe (a new layout, not an undo or another design): its fittings fly in, once
   * the wardrobe has been rebuilt with them. */
  const layouts = new Map<number, unknown>();
  let waiting: { ids: number[]; seen: number; still: number; frames: number } | null = null;
  function noticeLayouts(scene: EditorScene, fresh: boolean) {
    for (const w of scene.wardrobes) {
      const proposal = w.state.proposal;
      if (!fresh && proposal && layouts.has(w.id) && layouts.get(w.id) !== proposal && !reduced()) {
        waiting = { ids: [...(waiting?.ids ?? []), w.id], seen: renderState.buildStamp, still: 0, frames: 0 };
      }
      layouts.set(w.id, proposal);
    }
    // The fittings fly once the wardrobe has stopped rebuilding (applying a layout can rebuild it more than once).
    if (waiting) {
      if (renderState.buildStamp !== waiting.seen) { waiting.seen = renderState.buildStamp; waiting.still = 0; } else waiting.still++;
      waiting.frames++;
    }
    if (waiting && (waiting.still >= 2 || waiting.frames > 45)) {
      const ids = waiting.ids, groups = renderState.wardrobeGroups.filter(g => ids.includes(g.userData.wardrobe));
      waiting = null;
      if (groups.length && !assembly.busy()) void assembly.play(groups, { seconds: 1.9, phases: ['fitting', 'door'], onLand: phase => sounds.knock(KNOCKS[phase]) });
    }
  }

  let stamp = -1, previous = ports.scene();
  noticeLayouts(previous, true);
  resources.frameHooks.add((camera, dt) => {
    const moved = assembly.frame();
    // A design put in by anyone else (a shared link, an assistant, undo) ends the welcome where it is.
    const now = ports.scene();
    if (now !== previous) { if (welcome.isOpen() && !building && now !== shown) { before = shown = null; welcome.close(); } previous = now; layouts.clear(); waiting = null; }
    noticeLayouts(now, !layouts.size && now.wardrobes.length > 0);
    if (renderState.buildStamp !== stamp) {
      stamp = renderState.buildStamp;
      const box = ports.camera.sceneBox();
      lens.fit(box.x, box.z, Math.max(box.w, box.d));
      if (mood.apart) { assembly.explode(renderState.wardrobeGroups, mood.apart); resources.R.shadowMap.needsUpdate = true; }
    }
    lamps.sync(now.wardrobes, timeOfDay(mood.time).lamps && mood.look !== 'workshop');
    looks.frame();
    lens.frame(camera, cameraState.tgt, dt, reduced());
    framing.frame(camera, dt);
    // Shadows are redrawn once the parts have landed, not while they fly: a shadow map is costly on phones.
    if (moved && !assembly.busy()) resources.R.shadowMap.needsUpdate = true;
  });
  applyMood(false);

  // The menu offers the welcome again: a new design from what someone owns, which Undo takes back.
  const item = doc.createElement('button');
  item.type = 'button'; item.className = 'mi'; item.setAttribute('role', 'menuitem');
  item.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6"/></svg><span>Plan from what I own</span>';
  dom.$('#fitchip').before(item);
  lifetime.listen(item, 'click', () => { ports.closeMenu(); reveal.hide(); welcome.open(); });
  lifetime.cleanup(() => item.remove());

  const fresh = () => { const s = ports.scene(); return !s.wardrobes.length && (!s.studio || JSON.stringify(s.studio) === JSON.stringify(singleWallStudio())); };
  const params = new URLSearchParams(view?.location.search ?? ''), hash = view?.location.hash ?? '';
  const asked = params.get('welcome'), automated = !!(view?.navigator as Navigator | undefined)?.webdriver;
  // Automated browsers (scripted checks, assistants) drive the editor directly unless they ask for the welcome.
  const linked = /(^|[#&])(design|spec)=/.test(hash), opening = ports.scene();
  // A design link wins: it opens the design it carries, a moment after the editor starts.
  if (!linked && (asked === '1' || (asked !== '0' && !automated && fresh()))) lifetime.frame(() => { if (ports.scene() === opening) welcome.open(); });

  let kept: { snapshot: string; scene: EditorScene } | null = null;
  return {
    welcome: () => { reveal.hide(); welcome.open(); },
    /** The design as it was before the welcome, while the welcome previews spaces over it: what is saved. */
    persisted(): EditorScene | null {
      if (before === null) { kept = null; return null; }
      if (kept?.snapshot !== before) kept = { snapshot: before, scene: JSON.parse(before) as EditorScene };
      return kept.scene;
    },
    /** Draws the scene as it is (no look, wardrobes together) while `fn` runs: captures for images and previews. */
    neutral<T>(fn: () => T): T {
      assembly.finish(); assembly.explode(renderState.wardrobeGroups, 0); looks.suspend(); lens.hide(true); lamps.hide(true);
      resources.lighting.set(timeOfDay('midday').light);
      try { return fn(); } finally {
        looks.resume(); lens.hide(false); lamps.hide(false);
        resources.lighting.set(timeOfDay(mood.time).light);
        if (mood.apart) assembly.explode(renderState.wardrobeGroups, mood.apart);
      }
    },
  };
}
