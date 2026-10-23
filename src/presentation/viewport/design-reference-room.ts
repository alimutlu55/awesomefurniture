import * as THREE from 'three';
import { cornerDegree, roomHeight } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { ceilingFrame, profileAt } from '../../domain/studio/studio-ceiling';

const CONTEXT = 30, HEADROOM = 20;

/** Only the ceiling around the furniture belongs in its portrait, rather than an entire distant room. */
export function referenceRoomFeatures(studio: Studio | undefined, subject: readonly THREE.Vector3[]) {
  const features: { points: THREE.Vector3[]; normal: THREE.Vector3; mid: THREE.Vector3; free: boolean }[] = [];
  const top = studio ? roomHeight(studio) : Infinity;
  let eyeHeight = Math.min(135, top - HEADROOM);
  for (const ceiling of studio?.ceilings ?? []) {
    const frame = ceilingFrame(studio!, ceiling);
    if (!frame || !subject.length) continue;
    const local = subject.map(point => frame.local(point));
    const along = {
      from: Math.max(frame.along.from, Math.min(...local.map(p => p.s)) - CONTEXT),
      to: Math.min(frame.along.to, Math.max(...local.map(p => p.s)) + CONTEXT),
    };
    const across = {
      from: Math.max(frame.across.from, Math.min(...local.map(p => p.d)) - CONTEXT),
      to: Math.min(frame.across.to, Math.max(...local.map(p => p.d)) + CONTEXT),
    };
    if (along.to <= along.from || across.to <= across.from) continue;
    const span = ceiling.run === 'along' ? along : across;
    // Keep both sides of a vertical step, as well as interpolated ends of a clipped slope.
    const profile = [
      { t: span.from, y: profileAt(ceiling.profile, span.from)! },
      ...ceiling.profile.filter(p => p.t >= span.from && p.t <= span.to),
      { t: span.to, y: profileAt(ceiling.profile, span.to)! },
    ];
    const points: THREE.Vector3[] = [];
    for (const p of profile) {
      const crossSpan = ceiling.run === 'along' ? across : along;
      for (const cross of [crossSpan.from, crossSpan.to]) {
        const floor = ceiling.run === 'along' ? frame.at(p.t, cross) : frame.at(cross, p.t);
        points.push(new THREE.Vector3(floor.x, Math.min(top, p.y + (ceiling.run === 'along' ? (ceiling.edgeRise ?? 0) * cross / ceiling.depth : 0)), floor.z), new THREE.Vector3(floor.x, top, floor.z));
      }
      eyeHeight = Math.min(eyeHeight, p.y + Math.min(0, ceiling.edgeRise ?? 0) - HEADROOM);
    }
    const { line, wall } = frame;
    features.push({ points, normal: new THREE.Vector3(line.nx, 0, line.nz),
      mid: new THREE.Vector3((line.a.x + line.b.x) / 2, 0, (line.a.z + line.b.z) / 2),
      free: cornerDegree(studio!, wall.a) < 2 && cornerDegree(studio!, wall.b) < 2 });
  }
  return { features, eyeHeight: Math.max(15, eyeHeight) };
}
