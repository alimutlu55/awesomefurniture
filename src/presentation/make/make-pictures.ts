import * as THREE from 'three';
import { installWindow } from '../../domain/make/drawer-film';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Vec3 } from '../../domain/make/make-measures';
import { planShots } from './make-director';
import { printCamera } from '../drawings/print-camera';
import type { MakePlayer } from './make-player';
import type { MakeFilm } from './make-play-3d';

/**
 * The saved drawings' step pictures, taken from the assembly film itself, drawn the way the flat-pack manual is: Make's
 * Lines look (paper boards, ink outlines, the hardware in grey), white paper. For each step: the step done, seen as the
 * director frames the completed step, and a close-up of its first joint, as the film shows it while the
 * fasteners go in, with each fastener's way in drawn as a dashed line. Rendered off screen at twice the size and scaled
 * down, so outlines are smooth; JPEG bytes for the PDF.
 */
export interface Shot { readonly jpeg: Uint8Array; readonly width: number; readonly height: number }
/** A fastener's way in on a close-up, in its picture's fractions (0 to 1, y down). */
export interface Way { readonly from: readonly [number, number]; readonly to: readonly [number, number] }
export interface StepPicture { readonly whole: Shot | null; readonly detail: (Shot & { readonly ways: readonly Way[] }) | null }

export interface PictureStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  /** The piece's group in the scene (its frame: centred across and through, up from the floor). */
  readonly group: THREE.Object3D;
  readonly layer: number;
  readonly look: (lines: boolean) => void;
  readonly film: (film: MakeFilm | null) => void;
  readonly visibility: (camera: THREE.Camera) => void;
  readonly resolution: (width: number, height: number) => void;
  readonly fitDistance: (box: { x: number; y: number; z: number; w: number; h: number; d: number }, az: number, el: number, aspect: number) => number;
  readonly facing: number;
  readonly document: Pick<Document, 'createElement'>;
}

/** Outlines drawn this much heavier than on screen, so they print as ink, not hairlines. */
const LINE = .55;
const WHOLE = { w: 1500, h: 1000 }, DETAIL = { w: 900, h: 900 }, SUPER = 2, QUALITY = .9, PAPER = '#ffffff', INK = '#111111';

/** Renders the scene through `camera` off screen and returns it as a JPEG. */
function shoot(stage: PictureStage, camera: THREE.Camera, size: { w: number; h: number }): Shot {
  const W = size.w * SUPER, H = size.h * SUPER, target = new THREE.WebGLRenderTarget(W, H), r = stage.renderer;
  const before = r.getRenderTarget(), clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
  // The outlines keep their width as drawn at the picture's size: twice as wide in pixels at twice the size.
  stage.resolution(size.w * LINE, size.h * LINE); stage.visibility(camera);
  r.setRenderTarget(target); r.setClearColor(PAPER, 1); r.clear(); r.render(stage.scene, camera);
  const pixels = new Uint8Array(W * H * 4);
  r.readRenderTargetPixels(target, 0, 0, W, H, pixels);
  r.setRenderTarget(before); r.setClearColor(clear, alpha); target.dispose();
  // Rows come bottom first; a canvas the picture's size takes the image turned upright and scaled down.
  const big = stage.document.createElement('canvas'); big.width = W; big.height = H;
  const g = big.getContext('2d')!, image = g.createImageData(W, H);
  for (let y = 0; y < H; y++) image.data.set(pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  g.putImageData(image, 0, 0);
  const small = stage.document.createElement('canvas'); small.width = size.w; small.height = size.h;
  const s = small.getContext('2d')!;
  s.fillStyle = PAPER; s.fillRect(0, 0, size.w, size.h); s.imageSmoothingQuality = 'high'; s.drawImage(big, 0, 0, size.w, size.h);
  const data = atob(small.toDataURL('image/jpeg', QUALITY).split(',')[1]!), jpeg = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) jpeg[i] = data.charCodeAt(i);
  return { jpeg, width: size.w, height: size.h };
}

/** Every step's pictures. Leaves the film, the look and the outlines as they were. */
export function stepPictures(piece: MakePiece, player: MakePlayer, stage: PictureStage): StepPicture[] {
  const tl = player.timeline;
  if (!tl) return [];
  const time = player.time, toWorld = (p: THREE.Vector3) => stage.group.localToWorld(p);
  stage.group.updateMatrixWorld(true);
  const director = (aspect: number) => planShots({
    fittedCamera: (az, el, padding, box) => ({ az, el, dist: stage.fitDistance(box, az, el, aspect) * padding, x: box.x, y: box.y ?? box.h / 2, z: box.z }),
  }, piece, tl, player.staged, toWorld, stage.facing);
  const wide = director(WHOLE.w / WHOLE.h), close = director(DETAIL.w / DETAIL.h);
  const project = (camera: THREE.Camera, p: Vec3): [number, number] => {
    const v = toWorld(new THREE.Vector3(p[0] - piece.size.w / 2, p[1], p[2] - piece.size.d / 2)).project(camera);
    return [(v.x + 1) / 2, (1 - v.y) / 2];
  };
  stage.look(true);
  const out = tl.steps.map((s, k): StepPicture => {
    // The step done: held a moment before its end, as the director frames the piece so far. Putting the drawers on is
    // shown as it is done instead: the first drawer hooked on at the back, its front still held up.
    const hook = piece.steps[k]!.stage === 'drawers' ? installWindow(piece, tl, 0) : null;
    const end = hook ? hook[0] + (hook[1] - hook[0]) * .55 : s.end - .2;
    player.seek(end); stage.film(player.film());
    const whole = shoot(stage, printCamera(hook ? wide.at(end) : wide.completed(k, end), WHOLE.w / WHOLE.h, stage.layer), WHOLE);
    // Its first joint, while the fasteners go in, from where they can be seen going in.
    const fix = s.fixes[0];
    if (!fix || piece.steps[k]!.items.length === 0) return { whole, detail: null };
    const at = fix.at[0] + (fix.at[1] - fix.at[0]) * .45;
    player.seek(at); stage.film(player.film());
    const camera = printCamera(close.at(at), DETAIL.w / DETAIL.h, stage.layer), ways = (player.fixing()?.lines ?? []).map(l => ({ from: project(camera, l.from), to: project(camera, l.to) }));
    return { whole, detail: { ...shoot(stage, camera, DETAIL), ways } };
  });
  player.seek(time);
  stage.look(false);
  return out;
}

/** What saving the drawings needs from Make: its 3D, its player and the editor's camera maths. */
export interface PictureMake {
  readonly renderer: THREE.WebGLRenderer; readonly scene: THREE.Scene; readonly layer: number; readonly document: Pick<Document, 'createElement'>;
  readonly make3d: { readonly group: THREE.Object3D; setLook(look: 'lines' | 'material' | 'xray'): void; setPaper(paper: string, ink: string): void;
    setFilm(film: MakeFilm | null): void; updateVisibility(camera: THREE.Camera): void; setResolution(w: number, h: number): void };
  readonly camera: { cameraFitDistance(box: Parameters<PictureStage['fitDistance']>[0], az: number, el: number, aspect: number, minimum: number): number };
}
/** The step pictures for the saved drawings of the piece standing at `pose`, Make left showing what it showed (`restore`). */
export function picturesFor(piece: MakePiece, player: MakePlayer, m: PictureMake, pose: { y: number; angle: number }, restore: { look: 'lines' | 'material' | 'xray'; filming: boolean; paper(): void; size: readonly [number, number] }) {
  if (player.timeline === null) player.load(piece, -pose.y);
  const shown = stepPictures(piece, player, {
    renderer: m.renderer, scene: m.scene, group: m.make3d.group, layer: m.layer, facing: pose.angle * Math.PI / 180, document: m.document,
    look: lines => { m.make3d.setLook(lines ? 'lines' : restore.look); if (lines) m.make3d.setPaper(PAPER, INK); else restore.paper(); },
    film: film => m.make3d.setFilm(film), visibility: camera => m.make3d.updateVisibility(camera), resolution: (w, h) => m.make3d.setResolution(w, h),
    fitDistance: (box, az, el, aspect) => m.camera.cameraFitDistance(box, az, el, aspect, 24),
  });
  m.make3d.setFilm(restore.filming ? player.film() : null);
  m.make3d.setResolution(...restore.size);
  return shown;
}
