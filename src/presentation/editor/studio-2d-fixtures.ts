import type { Studio } from '../../domain/studio/studio';
import { fixtureObstacles } from '../../domain/studio/fixtures/fixture-place';
import { fixtureKind } from '../../domain/studio/fixtures/fixture-kinds';
import type { RoomSelection } from '../viewport/studio-renderer';
import { esc } from './editor-format.js';

export function renderFixtures(studio: Studio, selection: RoomSelection): string {
  return fixtureObstacles(studio).map(c => {
    const id = c.id.slice('fixture:'.length), fixture = studio.fixtures!.find(f => f.id === id)!;
    const selected = selection?.kind === 'fixture' && selection.id === id;
    return `<g class="sp2d-fixture${selected ? ' selected' : ''}" data-fixture-id="${id}" transform="translate(${c.x},${c.z}) rotate(${-c.angle})">
      <title>${esc(fixtureKind(fixture.kind)?.name ?? 'Fixture')}</title>
      <rect x="${-c.state.w / 2}" y="${-c.state.d / 2}" width="${c.state.w}" height="${c.state.d}" rx="${Math.min(c.state.w, c.state.d) / 4}"/>
      <ellipse cx="0" cy="2" rx="${c.state.w * .32}" ry="${c.state.d * .3}"/>
    </g>`;
  }).join('');
}
